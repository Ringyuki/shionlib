package download

import (
	"context"
	"slices"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/activity"
	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/apperror"
	"github.com/Ringyuki/shionlib/apps/api/internal/game"
	"github.com/Ringyuki/shionlib/apps/api/internal/message"
	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

type Deps struct {
	Repo       Repository
	Games      GameCards
	Sessions   Sessions
	Activities Activities
	Messages   Messenger
	Tx         Transactor
	Queue      Queue
	Store      ObjectStore
	Local      LocalFiles
	Settings   setting.Source
	Now        func() time.Time
}

type Service struct {
	repo       Repository
	games      GameCards
	sessions   Sessions
	activities Activities
	messages   Messenger
	tx         Transactor
	queue      Queue
	store      ObjectStore
	local      LocalFiles
	settings   setting.Source
	now        func() time.Time
}

func NewService(deps Deps) *Service {
	return &Service{
		repo:       deps.Repo,
		games:      deps.Games,
		sessions:   deps.Sessions,
		activities: deps.Activities,
		messages:   deps.Messages,
		tx:         deps.Tx,
		queue:      deps.Queue,
		store:      deps.Store,
		local:      deps.Local,
		settings:   deps.Settings,
		now:        deps.Now,
	}
}

func (s *Service) GameResources(ctx context.Context, viewer actor.Actor, gameID int) ([]GameResource, error) {
	exists, err := s.games.Exists(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, game.ErrNotFound
	}
	resources, err := s.repo.ListGameResources(ctx, gameID)
	if err != nil {
		return nil, err
	}
	visible := make([]GameResource, 0, len(resources))
	for _, resource := range resources {
		if !resource.VisibleTo(viewer.UserID) {
			continue
		}
		resource.Files = slices.DeleteFunc(resource.Files, func(f GameFile) bool {
			return f.Status != FileInObjectStore && f.CreatorID != viewer.UserID
		})
		if len(resource.Files) > 0 {
			visible = append(visible, resource)
		}
	}
	return visible, nil
}

func (s *Service) Releases(ctx context.Context, viewer actor.Actor, page Page) ([]Release, int, error) {
	releases, total, err := s.repo.ListReleases(ctx, !viewer.IncludesRated(), page)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, len(releases))
	for i, release := range releases {
		ids[i] = release.GameID
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return nil, 0, err
	}
	for i, release := range releases {
		releases[i].Game = cardOrStub(cards, release.GameID)
	}
	return releases, total, nil
}

func (s *Service) UserResources(ctx context.Context, viewer actor.Actor, userID int, page Page) (UserResources, error) {
	isCurrentUser := viewer.Authenticated() && viewer.UserID == userID
	items, total, err := s.repo.ListUserResources(ctx, userID, UserResourceFilter{ExcludeRated: !viewer.IncludesRated(), IncludeUnpublished: isCurrentUser}, page)
	if err != nil {
		return UserResources{}, err
	}
	ids := make([]int, len(items))
	for i, item := range items {
		ids[i] = item.GameID
	}
	cards, err := s.games.ByIDs(ctx, ids, viewer)
	if err != nil {
		return UserResources{}, err
	}
	for i, item := range items {
		items[i].Game = cardOrStub(cards, item.GameID)
	}
	result := UserResources{Items: items, Total: total, IsCurrentUser: isCurrentUser}
	if result.IsCurrentUser {
		result.HasOngoingSession, err = s.repo.HasUploadingSession(ctx, userID)
		if err != nil {
			return UserResources{}, err
		}
	}
	return result, nil
}

func (s *Service) Create(ctx context.Context, who actor.Actor, gameID int, in CreateInput) (Resource, error) {
	exists, err := s.games.Exists(ctx, gameID)
	if err != nil {
		return Resource{}, err
	}
	if !exists {
		return Resource{}, game.ErrNotFound
	}
	var created Resource
	err = s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.repo.CreateResource(ctx, NewResource{
			GameID:    gameID,
			Platforms: in.Platforms,
			Languages: in.Languages,
			Simulator: in.Simulator,
			Note:      in.Note,
			CreatorID: who.UserID,
		})
		if err != nil {
			return err
		}
		created = resource
		return s.attach(ctx, who, resource, in.Files, 0)
	})
	return created, err
}

func (s *Service) AddFiles(ctx context.Context, who actor.Actor, resourceID int, files []FileUpload) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.ownedResource(ctx, who, resourceID)
		if err != nil {
			return err
		}
		existing, err := s.repo.CountFiles(ctx, resource.ID)
		if err != nil {
			return err
		}
		return s.attach(ctx, who, resource, files, existing)
	})
}

func (s *Service) attach(ctx context.Context, who actor.Actor, resource Resource, files []FileUpload, existing int) error {
	if len(files) == 0 {
		return apperror.ErrValidationFailed.WithField("files", "at least one file is required")
	}
	if limit := MaxFilesPerResource.Read(s.settings); existing+len(files) > limit {
		return ErrTooManyFiles.WithArgs(map[string]any{"max": limit})
	}
	claimed := make(map[int]bool, len(files))
	for _, upload := range files {
		if claimed[upload.UploadSessionID] {
			return ErrSessionAlreadyUsed
		}
		claimed[upload.UploadSessionID] = true
		session, err := s.sessions.Claim(ctx, who, upload.UploadSessionID)
		if err != nil {
			return err
		}
		if _, used, err := s.repo.FindFileBySession(ctx, session.ID); err != nil {
			return err
		} else if used {
			return ErrSessionAlreadyUsed
		}
		name := upload.Name
		if name == "" {
			name = session.FileName
		}
		file, err := s.repo.CreateFile(ctx, NewFile{
			ResourceID:      resource.ID,
			Type:            FileTypeObjectStore,
			Name:            name,
			Path:            &session.StoragePath,
			Size:            session.TotalSize,
			ContentType:     session.MimeType,
			HashAlgorithm:   session.HashAlgorithm,
			Hash:            session.FileHash,
			UploadSessionID: &session.ID,
			Status:          FileOnServer,
			CreatorID:       who.UserID,
		})
		if err != nil {
			return err
		}
		if err := s.activities.Record(ctx, fileActivity(activity.TypeFileUploadToServer, who.UserID, resource.GameID, file.ID, FileOnServer, CheckPending, &session.TotalSize, &name)); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ownedResource(ctx context.Context, who actor.Actor, id int) (Resource, error) {
	resource, err := s.repo.LockResource(ctx, id)
	if err != nil {
		return Resource{}, err
	}
	if resource.Status != ResourceActive {
		return Resource{}, ErrResourceNotFound
	}
	if resource.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return Resource{}, ErrResourceNotOwner
	}
	return resource, nil
}

func (s *Service) ownedFile(ctx context.Context, who actor.Actor, id int) (File, error) {
	file, err := s.repo.LockFile(ctx, id)
	if err != nil {
		return File{}, err
	}
	if file.ResourceStatus != ResourceActive {
		return File{}, ErrFileNotFound
	}
	if file.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return File{}, ErrFileNotOwner
	}
	return file, nil
}

func (s *Service) RenameFile(ctx context.Context, who actor.Actor, fileID int, name string) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		file, err := s.ownedFile(ctx, who, fileID)
		if err != nil {
			return err
		}
		if err := s.repo.RenameFile(ctx, file.ID, name); err != nil {
			return err
		}
		return s.repo.TouchResource(ctx, file.ResourceID, s.now())
	})
}

func (s *Service) DeleteFile(ctx context.Context, who actor.Actor, fileID int) error {
	var removed File
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		file, err := s.ownedFile(ctx, who, fileID)
		if err != nil {
			return err
		}
		if file.CheckStatus == CheckHarmfulPendingReview && !who.AtLeast(actor.RoleAdmin) {
			return ErrFileUnderReview
		}
		remaining, err := s.repo.CountFiles(ctx, file.ResourceID)
		if err != nil {
			return err
		}
		if remaining <= 1 {
			return ErrLastFile
		}
		if err := s.repo.DeleteFile(ctx, file.ID); err != nil {
			return err
		}
		if err := s.repo.TouchResource(ctx, file.ResourceID, s.now()); err != nil {
			return err
		}
		removed = file
		return publishResource(ctx, s.repo, s.messages, file.ResourceID, s.now())
	})
	if err != nil {
		return err
	}
	if removed.Path != nil && s.local.Owns(*removed.Path) {
		if err := s.local.Remove(ctx, *removed.Path); err != nil {
			return err
		}
	}
	return s.PurgeLater(ctx, storageKeys([]File{removed}))
}

func (s *Service) Edit(ctx context.Context, who actor.Actor, id int, changes ResourceChanges) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.ownedResource(ctx, who, id); err != nil {
			return err
		}
		return s.repo.UpdateResource(ctx, id, changes)
	})
}

func (s *Service) Delete(ctx context.Context, who actor.Actor, id int) error {
	resource, err := s.repo.GetResource(ctx, id)
	if err != nil {
		return err
	}
	if who.Role != actor.RoleSuperAdmin {
		return ErrResourceNotOwner
	}
	files, err := s.repo.ListFiles(ctx, resource.ID)
	if err != nil {
		return err
	}
	for _, key := range storageKeys(files) {
		if err := s.store.Delete(ctx, key); err != nil {
			return err
		}
	}
	return s.repo.DeleteResource(ctx, resource.ID)
}

func (s *Service) Resource(ctx context.Context, id int) (Resource, error) {
	return s.repo.GetResource(ctx, id)
}

func (s *Service) TakeDown(ctx context.Context, resourceID int) ([]string, error) {
	var keys []string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		resource, err := s.repo.LockResource(ctx, resourceID)
		if err != nil {
			return err
		}
		files, err := s.repo.ListFiles(ctx, resource.ID)
		if err != nil {
			return err
		}
		keys = storageKeys(files)
		return s.repo.SetResourceStatus(ctx, resource.ID, ResourceRemoved, s.now())
	})
	return keys, err
}

func (s *Service) PurgeLater(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	return s.queue.Enqueue(ctx, PurgeObjects{Keys: keys, Before: s.now()})
}

func (s *Service) ListObjects(ctx context.Context) (Listing, error) {
	return s.store.List(ctx)
}

func (s *Service) DeleteObject(ctx context.Context, key string) error {
	if key == "" {
		return nil
	}
	return s.store.Delete(ctx, key)
}

func (s *Service) MigrateResource(ctx context.Context, gameID int, in MigrateResourceInput) (int, error) {
	var id int
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		exists, err := s.games.Exists(ctx, gameID)
		if err != nil {
			return err
		}
		if !exists {
			return game.ErrNotFound
		}
		resource, err := s.repo.CreateResource(ctx, NewResource{
			GameID:    gameID,
			Platforms: in.Platforms,
			Languages: in.Languages,
			Simulator: in.Simulator,
			Note:      in.Note,
			CreatorID: migrationCreatorID,
		})
		id = resource.ID
		return err
	})
	return id, err
}

func (s *Service) MigrateFile(ctx context.Context, resourceID int, in MigrateFileInput) error {
	return s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		if _, err := s.repo.CreateFile(ctx, NewFile{
			ResourceID:    resourceID,
			Type:          FileTypeObjectStore,
			Name:          in.FileName,
			Size:          in.FileSize,
			StorageKey:    &in.StorageKey,
			ContentType:   &in.ContentType,
			HashAlgorithm: upload.HashBLAKE3,
			Hash:          in.FileHash,
			Status:        FileInObjectStore,
			CreatorID:     migrationCreatorID,
		}); err != nil {
			return err
		}
		_, err := s.repo.PublishIfReady(ctx, resourceID, s.now())
		return err
	})
}

func (s *Service) Reupload(ctx context.Context, who actor.Actor, fileID int, in ReuploadInput) error {
	var purge []string
	err := s.tx.WithinTransaction(ctx, func(ctx context.Context) error {
		file, err := s.repo.LockFile(ctx, fileID)
		if err != nil {
			return err
		}
		if file.ResourceStatus != ResourceActive {
			return ErrFileNotFound
		}
		if file.Status != FileInObjectStore {
			return upload.ErrInvalidFileStatus
		}
		if file.CreatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
			return ErrFileNotOwner
		}
		session, err := s.sessions.Claim(ctx, who, in.UploadSessionID)
		if err != nil {
			return err
		}
		if other, found, err := s.repo.FindFileBySession(ctx, session.ID); err != nil {
			return err
		} else if found && other.ID != file.ID {
			return upload.ErrSessionAlreadyUsed
		}
		if err := s.repo.CreateHistory(ctx, NewHistory{
			FileID:          file.ID,
			Size:            session.TotalSize,
			HashAlgorithm:   session.HashAlgorithm,
			Hash:            session.FileHash,
			Reason:          in.Reason,
			UploadSessionID: &session.ID,
			OperatorID:      who.UserID,
		}); err != nil {
			return err
		}
		if err := s.repo.TouchResource(ctx, file.ResourceID, s.now()); err != nil {
			return err
		}
		if err := s.repo.ReplaceFileContent(ctx, file.ID, FileContent{
			Path:            session.StoragePath,
			Size:            session.TotalSize,
			Hash:            session.FileHash,
			HashAlgorithm:   session.HashAlgorithm,
			ContentType:     session.MimeType,
			UploadSessionID: session.ID,
		}); err != nil {
			return err
		}
		if err := s.activities.Record(ctx, fileActivity(activity.TypeFileReupload, who.UserID, file.GameID, file.ID, FileOnServer, CheckPending, &session.TotalSize, &file.Name)); err != nil {
			return err
		}
		if file.StorageKey != nil {
			purge = []string{*file.StorageKey}
		}
		return s.notifyFavorites(ctx, who, file, in.Reason)
	})
	if err != nil {
		return err
	}
	return s.PurgeLater(ctx, purge)
}

func (s *Service) notifyFavorites(ctx context.Context, who actor.Actor, file File, reason *string) error {
	receivers, err := s.repo.FavoriteReceivers(ctx, file.GameID, who.UserID)
	if err != nil || len(receivers) == 0 {
		return err
	}
	cards, err := s.games.ByIDs(ctx, []int{file.GameID}, who)
	if err != nil {
		return err
	}
	card := cardOrStub(cards, file.GameID)
	meta := message.Meta{
		"file_name":     file.Name,
		"game_title_jp": card.TitleJP,
		"game_title_zh": card.TitleZH,
		"game_title_en": card.TitleEN,
	}
	if reason != nil && *reason != "" {
		meta["reason"] = *reason
	}
	gameID := file.GameID
	for _, receiver := range receivers {
		if err := s.messages.Send(ctx, message.NewMessage{
			Type:       message.TypeSystem,
			Tone:       message.ToneSuccess,
			Title:      "Messages.System.File.Reupload.FileReuploadedTitle",
			Content:    "Messages.System.File.Reupload.FileReuploadedContent",
			GameID:     &gameID,
			Meta:       meta,
			ReceiverID: receiver,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) History(ctx context.Context, fileID int) ([]HistoryEntry, error) {
	if _, err := s.repo.GetFile(ctx, fileID); err != nil {
		return nil, err
	}
	return s.repo.ListHistory(ctx, fileID)
}

func (s *Service) EditHistoryReason(ctx context.Context, who actor.Actor, historyID int, reason *string) error {
	history, err := s.repo.GetHistory(ctx, historyID)
	if err != nil {
		return err
	}
	if history.OperatorID != who.UserID && !who.AtLeast(actor.RoleAdmin) {
		return ErrFileNotOwner
	}
	if reason != nil && *reason == "" {
		reason = nil
	}
	return s.repo.SetHistoryReason(ctx, history.ID, reason)
}

func storageKeys(files []File) []string {
	var keys []string
	for _, file := range files {
		if file.StorageKey != nil && *file.StorageKey != "" {
			keys = append(keys, *file.StorageKey)
		}
	}
	return keys
}

func cardOrStub(cards map[int]game.Card, id int) game.Card {
	if card, ok := cards[id]; ok {
		return card
	}
	return game.Card{ID: id}
}

func fileActivity(kind activity.Type, userID, gameID, fileID, status int, check CheckStatus, size *int64, name *string) activity.NewActivity {
	checkValue := int(check)
	return activity.NewActivity{
		Type:            kind,
		UserID:          userID,
		GameID:          &gameID,
		FileID:          &fileID,
		FileStatus:      &status,
		FileCheckStatus: &checkValue,
		FileSize:        size,
		FileName:        name,
	}
}

func (s *Service) RequeueStores(ctx context.Context, updatedBefore time.Time) error {
	ids, err := s.repo.ListAwaitingStore(ctx, updatedBefore, requeueBatch)
	if err != nil {
		return err
	}
	for _, id := range ids {
		if err := s.queue.Enqueue(ctx, StoreFile{FileID: id}); err != nil {
			return err
		}
	}
	return nil
}
