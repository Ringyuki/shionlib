package downloadhttp

import (
	"context"
	"net/http"

	"github.com/Ringyuki/shionlib/apps/api/internal/actor"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/httpapi"
	"github.com/Ringyuki/shionlib/apps/api/internal/transport/http/response"
)

var (
	tags        = []string{"download"}
	storageTags = []string{"storage"}
)

type Handler struct {
	service *download.Service
	links   *download.Links
	resp    *response.Builder
}

func NewHandler(service *download.Service, links *download.Links, resp *response.Builder) *Handler {
	return &Handler{service: service, links: links, resp: resp}
}

func (h *Handler) Register(api *httpapi.API) {
	httpapi.Register(api, httpapi.Route{ID: "download.gameResources", Method: http.MethodGet, Path: "/game/{id}/download-source", Summary: "List the download resources of a game", Tags: tags}, h.gameResources)
	httpapi.Register(api, httpapi.Route{ID: "download.link", Method: http.MethodGet, Path: "/game/download/{id}/link", Summary: "Issue a download link for a file", Tags: tags, Throttle: "download"}, h.link)
	httpapi.Register(api, httpapi.Route{ID: "download.create", Method: http.MethodPost, Path: "/game/{id}/download-source", Summary: "Create a download resource from a completed upload", Tags: tags, Access: httpapi.AccessUser}, h.create)
	httpapi.Register(api, httpapi.Route{ID: "download.releases", Method: http.MethodGet, Path: "/game/download-source/list", Summary: "List recently released download resources", Tags: tags}, h.releases)
	httpapi.Register(api, httpapi.Route{ID: "download.delete", Method: http.MethodDelete, Path: "/game/download-source/{id}", Summary: "Delete a download resource and its stored objects", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.delete)
	httpapi.Register(api, httpapi.Route{ID: "download.edit", Method: http.MethodPatch, Path: "/game/download-source/{id}", Summary: "Edit a download resource", Tags: tags, Access: httpapi.AccessUser}, h.edit)
	httpapi.Register(api, httpapi.Route{ID: "download.migrateResource", Method: http.MethodPost, Path: "/game/download-source/migrate/{gameId}", Summary: "Import a download resource", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.migrateResource)
	httpapi.Register(api, httpapi.Route{ID: "download.migrateFile", Method: http.MethodPost, Path: "/game/download-source/migrate/file/{downloadSourceId}", Summary: "Import a stored file into a download resource", Tags: tags, Access: httpapi.AccessSuperAdmin}, h.migrateFile)
	httpapi.Register(api, httpapi.Route{ID: "download.reupload", Method: http.MethodPut, Path: "/game/download-source/file/{fileId}/reupload", Summary: "Replace a stored file with a new upload", Tags: tags, Access: httpapi.AccessUser}, h.reupload)
	httpapi.Register(api, httpapi.Route{ID: "download.history", Method: http.MethodGet, Path: "/game/download-source/file/{fileId}/history", Summary: "List the upload history of a file", Tags: tags}, h.history)
	httpapi.Register(api, httpapi.Route{ID: "download.historyReason", Method: http.MethodPatch, Path: "/game/download-source/file-history/{historyId}/reason", Summary: "Edit the reason of a file history entry", Tags: tags, Access: httpapi.AccessUser}, h.historyReason)
	httpapi.Register(api, httpapi.Route{ID: "download.userResources", Method: http.MethodGet, Path: "/user/datas/{id}/game-resources", Summary: "List the download resources uploaded by a user", Tags: tags}, h.userResources)
	httpapi.Register(api, httpapi.Route{ID: "storage.list", Method: http.MethodGet, Path: "/s3/test/file/list", Summary: "List objects of the game bucket", Tags: storageTags, Access: httpapi.AccessSuperAdmin}, h.listObjects)
	httpapi.Register(api, httpapi.Route{ID: "storage.delete", Method: http.MethodDelete, Path: "/s3/test/file", Summary: "Delete every version of an object in the game bucket", Tags: storageTags, Access: httpapi.AccessSuperAdmin}, h.deleteObject)
}

func (h *Handler) gameResources(ctx context.Context, in *downloadGamePath) (*response.Output[[]downloadResourceDTO], error) {
	resources, err := h.service.GameResources(ctx, actor.From(ctx), in.ID)
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	out := make([]downloadResourceDTO, len(resources))
	for i, resource := range resources {
		out[i] = toResourceDTO(resource, now)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) link(ctx context.Context, in *downloadLinkInput) (*response.Output[downloadLinkDTO], error) {
	link, err := h.links.Issue(ctx, in.ID, in.Token)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, downloadLinkDTO{FileURL: link.URL, ExpiresIn: link.ExpiresIn}), nil
}

func (h *Handler) create(ctx context.Context, in *createDownloadSourceInput) (*response.EmptyOutput, error) {
	err := h.service.Create(ctx, actor.From(ctx), in.ID, download.CreateInput{
		FileName:        in.Body.FileName,
		Platforms:       in.Body.Platform,
		Languages:       in.Body.Language,
		Simulator:       in.Body.Simulator,
		Note:            in.Body.Note,
		UploadSessionID: in.Body.UploadSessionID,
	})
	if err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) releases(ctx context.Context, in *releaseListInput) (*response.Output[downloadReleasePageDTO], error) {
	viewer := actor.From(ctx)
	releases, total, err := h.service.Releases(ctx, viewer, download.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := downloadReleasePageDTO{
		Items: make([]downloadReleaseDTO, len(releases)),
		Meta:  downloadReleaseMeta{PageMeta: response.NewPageMeta(total, len(releases), in.PageSize, in.Page), ContentLimit: int(viewer.ContentLimit)},
	}
	for i, release := range releases {
		page.Items[i] = toReleaseDTO(release, now)
	}
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) delete(ctx context.Context, in *downloadResourcePath) (*response.EmptyOutput, error) {
	if err := h.service.Delete(ctx, actor.From(ctx), in.ID); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) edit(ctx context.Context, in *editDownloadSourceInput) (*response.EmptyOutput, error) {
	err := h.service.Edit(ctx, actor.From(ctx), in.ID, download.ResourceChanges{
		Platforms: in.Body.Platform,
		Languages: in.Body.Language,
		Simulator: in.Body.Simulator,
		Note:      in.Body.Note,
		FileName:  in.Body.FileName,
	})
	if err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) migrateResource(ctx context.Context, in *downloadMigrateResourceInput) (*response.Output[int], error) {
	id, err := h.service.MigrateResource(ctx, in.GameID, download.MigrateResourceInput{
		Platforms: in.Body.Platform,
		Languages: in.Body.Language,
		Simulator: in.Body.Simulator,
		Note:      in.Body.Note,
	})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, id), nil
}

func (h *Handler) migrateFile(ctx context.Context, in *downloadMigrateFileInput) (*response.EmptyOutput, error) {
	err := h.service.MigrateFile(ctx, in.DownloadSourceID, download.MigrateFileInput{
		FileName:    in.Body.FileName,
		FileSize:    in.Body.FileSize,
		FileHash:    in.Body.FileHash,
		ContentType: in.Body.FileContentType,
		StorageKey:  in.Body.S3FileKey,
	})
	if err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) reupload(ctx context.Context, in *downloadReuploadInput) (*response.Output[downloadReuploadDTO], error) {
	err := h.service.Reupload(ctx, actor.From(ctx), in.FileID, download.ReuploadInput{UploadSessionID: in.Body.UploadSessionID, Reason: in.Body.Reason})
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, downloadReuploadDTO{OK: true}), nil
}

func (h *Handler) history(ctx context.Context, in *fileHistoryPath) (*response.Output[[]downloadHistoryDTO], error) {
	entries, err := h.service.History(ctx, in.FileID)
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	out := make([]downloadHistoryDTO, len(entries))
	for i, entry := range entries {
		out[i] = toHistoryDTO(entry, now)
	}
	return response.OK(ctx, h.resp, out), nil
}

func (h *Handler) historyReason(ctx context.Context, in *downloadHistoryReasonInput) (*response.EmptyOutput, error) {
	if err := h.service.EditHistoryReason(ctx, actor.From(ctx), in.HistoryID, in.Body.Reason); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}

func (h *Handler) userResources(ctx context.Context, in *userResourcesInput) (*response.Output[downloadUserResourcePageDTO], error) {
	viewer := actor.From(ctx)
	result, err := h.service.UserResources(ctx, viewer, in.ID, download.Page{Number: in.Page, Size: in.PageSize})
	if err != nil {
		return nil, err
	}
	now := h.resp.Now()
	page := downloadUserResourcePageDTO{
		Items: make([]downloadUserResourceDTO, len(result.Items)),
		Meta: downloadUserResourceMeta{
			PageMeta:          response.NewPageMeta(result.Total, len(result.Items), in.PageSize, in.Page),
			IsCurrentUser:     result.IsCurrentUser,
			HasOnGoingSession: result.HasOngoingSession,
			ContentLimit:      int(viewer.ContentLimit),
		},
	}
	for i, item := range result.Items {
		page.Items[i] = toUserResourceDTO(item, now)
	}
	return response.OK(ctx, h.resp, page), nil
}

func (h *Handler) listObjects(ctx context.Context, _ *struct{}) (*response.Output[storageListingDTO], error) {
	listing, err := h.service.ListObjects(ctx)
	if err != nil {
		return nil, err
	}
	return response.OK(ctx, h.resp, toListingDTO(listing)), nil
}

func (h *Handler) deleteObject(ctx context.Context, in *objectDeleteInput) (*response.EmptyOutput, error) {
	if err := h.service.DeleteObject(ctx, in.Key); err != nil {
		return nil, err
	}
	return response.Empty(ctx, h.resp), nil
}
