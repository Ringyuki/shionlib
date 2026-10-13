package inspectionpg

import (
	"context"
	"fmt"
	"slices"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	entinspection "github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/inspection"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/inspectionentry"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent/predicate"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/inspection"
)

const (
	resourceFK = "file_inspections_resource_id_fkey"
	entryFK    = "file_inspection_entries_inspection_id_fkey"
)

const locationsQuery = `
WITH RECURSIVE chain AS (
	SELECT id AS origin, parent_id, name, 0 AS depth FROM file_inspection_entries WHERE id = ANY($1)
	UNION ALL
	SELECT chain.origin, parent.parent_id, parent.name, chain.depth + 1
	FROM chain JOIN file_inspection_entries parent ON parent.id = chain.parent_id
)
SELECT origin, string_agg(name, '/' ORDER BY depth DESC) FROM chain GROUP BY origin`

const filePathsQuery = `
WITH RECURSIVE tree AS (
	SELECT id, name::text AS path, kind, size FROM file_inspection_entries WHERE inspection_id = $1 AND parent_id IS NULL
	UNION ALL
	SELECT child.id, tree.path || '/' || child.name, child.kind, child.size
	FROM file_inspection_entries child JOIN tree ON child.parent_id = tree.id
	WHERE child.inspection_id = $1 AND tree.kind = 'folder'
)
SELECT path, size FROM tree WHERE kind NOT IN ('folder', 'track') ORDER BY id`

type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

func (r *Repository) db(ctx context.Context) *ent.Client {
	return postgres.Client(ctx, r.client)
}

func (r *Repository) Create(ctx context.Context, in inspection.NewInspection) (int, error) {
	detections, err := encodeDetections(in.Scan.Detections)
	if err != nil {
		return 0, fmt.Errorf("encode detections of the inspection of resource %d: %w", in.ResourceID, err)
	}
	create := r.db(ctx).Inspection.Create().
		SetResourceID(in.ResourceID).
		SetStatus(string(in.Status)).
		SetArchiveFormat(in.Archive.Format).
		SetSolid(in.Archive.Solid).
		SetVolumes(in.Archive.Volumes).
		SetRecovery(in.Archive.Recovery).
		SetRecoveryPercent(in.Archive.RecoveryPercent).
		SetNameEncoding(in.Archive.NameEncoding).
		SetUnsupportedMethod(in.Archive.Unsupported).
		SetFileCount(in.Totals.Files).
		SetFolderCount(in.Totals.Folders).
		SetUnpackedSize(in.Totals.Size).
		SetDiscCount(in.Totals.Discs).
		SetDiscFileCount(in.Totals.DiscFiles).
		SetTruncated(in.Truncated).
		SetVerified(in.Verified).
		SetScanEngine(in.Scan.Engine).
		SetNillableSignaturesAt(in.Scan.SignaturesAt).
		SetScannedCount(in.Scan.Scanned).
		SetScanSkipped(pgvalue.Strings(in.Scan.Skipped)).
		SetScanLimit(in.Scan.Limit).
		SetNillableScannedAt(in.Scan.At).
		SetNillableClearedAt(in.Scan.ClearedAt)
	if detections != nil {
		create.SetDetections(detections)
	}
	row, err := create.Save(ctx)
	if postgres.IsForeignKeyViolation(err, resourceFK) {
		return 0, inspection.ErrResourceGone
	}
	if err != nil {
		return 0, fmt.Errorf("create the inspection of resource %d: %w", in.ResourceID, err)
	}
	return row.ID, nil
}

func (r *Repository) AddEntries(ctx context.Context, inspectionID int, entries []inspection.NewEntry) ([]int, error) {
	if len(entries) == 0 {
		return []int{}, nil
	}
	db := r.db(ctx)
	builders := make([]*ent.InspectionEntryCreate, len(entries))
	for i, entry := range entries {
		detail, err := encodeDetail(entry.Detail)
		if err != nil {
			return nil, fmt.Errorf("encode an entry of inspection %d: %w", inspectionID, err)
		}
		builder := db.InspectionEntry.Create().
			SetInspectionID(inspectionID).
			SetNillableParentID(entry.ParentID).
			SetPosition(entry.Position).
			SetName(entry.Name).
			SetKind(string(entry.Kind)).
			SetSize(entry.Size).
			SetNillableModified(entry.Modified).
			SetItems(entry.Items).
			SetChildren(entry.Children).
			SetEncrypted(entry.Encrypted).
			SetUnreadable(entry.Unreadable)
		if detail != nil {
			builder.SetDetail(detail)
		}
		builders[i] = builder
	}
	rows, err := db.InspectionEntry.CreateBulk(builders...).Save(ctx)
	if postgres.IsForeignKeyViolation(err, entryFK) {
		return nil, inspection.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("add entries to inspection %d: %w", inspectionID, err)
	}
	ids := make([]int, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	return ids, nil
}

func (r *Repository) SetPreview(ctx context.Context, entryID int, preview inspection.Preview) error {
	err := r.db(ctx).InspectionEntry.UpdateOneID(entryID).SetPreview(string(preview)).Exec(ctx)
	if postgres.IsNotFound(err) {
		return inspection.ErrEntryNotFound
	}
	if err != nil {
		return fmt.Errorf("set the preview of inspection entry %d: %w", entryID, err)
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, id int) (inspection.Inspection, error) {
	row, err := r.db(ctx).Inspection.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return inspection.Inspection{}, inspection.ErrNotFound
	}
	if err != nil {
		return inspection.Inspection{}, fmt.Errorf("get inspection %d: %w", id, err)
	}
	return toInspection(row)
}

func (r *Repository) ByIDs(ctx context.Context, ids []int) ([]inspection.Inspection, error) {
	if len(ids) == 0 {
		return []inspection.Inspection{}, nil
	}
	rows, err := r.db(ctx).Inspection.Query().Where(entinspection.IDIn(ids...)).Order(ent.Asc(entinspection.FieldID)).All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load inspections: %w", err)
	}
	found := make([]inspection.Inspection, len(rows))
	for i, row := range rows {
		item, err := toInspection(row)
		if err != nil {
			return nil, err
		}
		found[i] = item
	}
	return found, nil
}

func (r *Repository) Discs(ctx context.Context, inspectionIDs []int) ([]inspection.Entry, error) {
	if len(inspectionIDs) == 0 {
		return []inspection.Entry{}, nil
	}
	rows, err := r.db(ctx).InspectionEntry.Query().
		Where(inspectionentry.InspectionIDIn(inspectionIDs...), inspectionentry.Kind(string(inspection.KindDisc))).
		Order(ent.Asc(inspectionentry.FieldInspectionID), ent.Asc(inspectionentry.FieldID)).
		All(ctx)
	if err != nil {
		return nil, fmt.Errorf("load the disc images of inspections: %w", err)
	}
	return toEntries(rows)
}

func (r *Repository) MediumNames(ctx context.Context, inspectionID int) ([]string, error) {
	sheets := make([]predicate.InspectionEntry, len(inspection.SheetExtensions))
	for i, extension := range inspection.SheetExtensions {
		sheets[i] = predicate.InspectionEntry(sql.FieldHasSuffixFold(inspectionentry.FieldName, "."+extension))
	}
	names, err := r.db(ctx).InspectionEntry.Query().
		Where(
			inspectionentry.InspectionID(inspectionID),
			inspectionentry.Or(
				inspectionentry.Kind(string(inspection.KindDisc)),
				inspectionentry.And(inspectionentry.Kind(string(inspection.KindFile)), inspectionentry.Or(sheets...)),
			),
		).
		Order(ent.Asc(inspectionentry.FieldID)).
		Select(inspectionentry.FieldName).
		Strings(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the disc files of inspection %d: %w", inspectionID, err)
	}
	return names, nil
}

func (r *Repository) FilePaths(ctx context.Context, inspectionID int) ([]inspection.FilePath, error) {
	rows, err := r.db(ctx).QueryContext(ctx, filePathsQuery, inspectionID)
	if err != nil {
		return nil, fmt.Errorf("list the files of inspection %d: %w", inspectionID, err)
	}
	defer func() { _ = rows.Close() }()
	files := []inspection.FilePath{}
	for rows.Next() {
		var file inspection.FilePath
		if err := rows.Scan(&file.Path, &file.Size); err != nil {
			return nil, fmt.Errorf("read a file of inspection %d: %w", inspectionID, err)
		}
		files = append(files, file)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list the files of inspection %d: %w", inspectionID, err)
	}
	return files, nil
}

func (r *Repository) Children(ctx context.Context, inspectionID int, parentID *int, page inspection.Page) ([]inspection.Entry, int, error) {
	under := inspectionentry.ParentIDIsNil()
	if parentID != nil {
		under = inspectionentry.ParentID(*parentID)
	}
	query := r.db(ctx).InspectionEntry.Query().Where(inspectionentry.InspectionID(inspectionID), under)
	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count entries of inspection %d: %w", inspectionID, err)
	}
	rows, err := query.
		Order(ent.Asc(inspectionentry.FieldPosition), ent.Asc(inspectionentry.FieldID)).
		Offset(page.Offset()).
		Limit(page.Size).
		All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("list entries of inspection %d: %w", inspectionID, err)
	}
	entries, err := toEntries(rows)
	return entries, total, err
}

func byName() inspectionentry.OrderOption {
	return func(s *sql.Selector) {
		s.OrderExprFunc(func(b *sql.Builder) {
			b.WriteString("lower(").Ident(s.C(inspectionentry.FieldName)).WriteString(`) COLLATE "C"`)
		})
	}
}

func (r *Repository) Search(ctx context.Context, inspectionID int, query string, page inspection.Page) ([]inspection.Found, int, error) {
	matching := r.db(ctx).InspectionEntry.Query().Where(
		inspectionentry.InspectionID(inspectionID),
		inspectionentry.KindNEQ(string(inspection.KindFolder)),
		inspectionentry.NameContainsFold(query),
	)
	total, err := matching.Clone().Count(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("count matches in inspection %d: %w", inspectionID, err)
	}
	rows, err := matching.Order(byName(), ent.Asc(inspectionentry.FieldID)).Offset(page.Offset()).Limit(page.Size).All(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("search inspection %d: %w", inspectionID, err)
	}
	entries, err := toEntries(rows)
	if err != nil {
		return nil, 0, err
	}
	locations, err := r.locations(ctx, entries)
	if err != nil {
		return nil, 0, err
	}
	found := make([]inspection.Found, len(entries))
	for i, entry := range entries {
		found[i] = inspection.Found{Entry: entry}
		if entry.ParentID != nil {
			found[i].Location = locations[*entry.ParentID]
		}
	}
	return found, total, nil
}

func (r *Repository) locations(ctx context.Context, entries []inspection.Entry) (map[int]string, error) {
	var parents []int
	for _, entry := range entries {
		if entry.ParentID != nil && !slices.Contains(parents, *entry.ParentID) {
			parents = append(parents, *entry.ParentID)
		}
	}
	locations := map[int]string{}
	if len(parents) == 0 {
		return locations, nil
	}
	rows, err := r.db(ctx).QueryContext(ctx, locationsQuery, pgvalue.Ints(parents))
	if err != nil {
		return nil, fmt.Errorf("load the locations of inspection entries: %w", err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var id int
		var location string
		if err := rows.Scan(&id, &location); err != nil {
			return nil, fmt.Errorf("read the location of an inspection entry: %w", err)
		}
		locations[id] = location
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read the locations of inspection entries: %w", err)
	}
	return locations, nil
}

func (r *Repository) GetEntry(ctx context.Context, id int) (inspection.Entry, error) {
	row, err := r.db(ctx).InspectionEntry.Get(ctx, id)
	if postgres.IsNotFound(err) {
		return inspection.Entry{}, inspection.ErrEntryNotFound
	}
	if err != nil {
		return inspection.Entry{}, fmt.Errorf("get inspection entry %d: %w", id, err)
	}
	return toEntry(row)
}

func (r *Repository) MarkCleared(ctx context.Context, ids []int, at time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	if err := r.db(ctx).Inspection.Update().Where(entinspection.IDIn(ids...)).SetClearedAt(at.UTC()).Exec(ctx); err != nil {
		return fmt.Errorf("mark inspections as cleared: %w", err)
	}
	return nil
}

func (r *Repository) Orphans(ctx context.Context, before time.Time, limit int) ([]int, error) {
	ids, err := r.db(ctx).Inspection.Query().
		Where(entinspection.Not(entinspection.HasFiles()), entinspection.CreatedLTE(before.UTC())).
		Order(ent.Asc(entinspection.FieldID)).
		Limit(limit).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list inspections without files: %w", err)
	}
	return ids, nil
}

func (r *Repository) PreviewEntries(ctx context.Context, inspectionID int) ([]int, error) {
	ids, err := r.db(ctx).InspectionEntry.Query().
		Where(inspectionentry.InspectionID(inspectionID), inspectionentry.PreviewNEQ(string(inspection.PreviewNone))).
		Order(ent.Asc(inspectionentry.FieldID)).
		IDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list the previews of inspection %d: %w", inspectionID, err)
	}
	return ids, nil
}

func (r *Repository) Delete(ctx context.Context, id int) error {
	err := r.db(ctx).Inspection.DeleteOneID(id).Exec(ctx)
	if postgres.IsNotFound(err) {
		return inspection.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete inspection %d: %w", id, err)
	}
	return nil
}
