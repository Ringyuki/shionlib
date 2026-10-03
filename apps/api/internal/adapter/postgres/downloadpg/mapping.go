package downloadpg

import (
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/download"
	"github.com/Ringyuki/shionlib/apps/api/internal/upload"
)

func toResource(row *ent.GameDownloadResource) download.Resource {
	resource := download.Resource{
		ID:              row.ID,
		GameID:          row.GameID,
		Status:          row.Status,
		Platforms:       nonNilStrings(row.Platform),
		Languages:       nonNilStrings(row.Language),
		Note:            row.Note,
		Downloads:       row.Downloads,
		UploadSessionID: row.UploadSessionID,
		CreatorID:       row.CreatorID,
		Created:         row.Created,
		Updated:         row.Updated,
	}
	if row.Simulator != nil {
		simulator := string(*row.Simulator)
		resource.Simulator = &simulator
	}
	return resource
}

func toFiles(rows []*ent.GameDownloadResourceFile) []download.File {
	files := make([]download.File, len(rows))
	for i, row := range rows {
		files[i] = toFile(row, row.Edges.GameDownloadResource)
	}
	return files
}

func toFile(row *ent.GameDownloadResourceFile, resource *ent.GameDownloadResource) download.File {
	file := download.File{
		ID:              row.ID,
		ResourceID:      row.GameDownloadResourceID,
		Type:            row.Type,
		Name:            row.FileName,
		Path:            row.FilePath,
		Size:            row.FileSize,
		URL:             row.FileURL,
		StorageKey:      row.S3FileKey,
		ContentType:     row.FileContentType,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		UploadSessionID: row.UploadSessionID,
		Status:          row.FileStatus,
		CheckStatus:     download.CheckStatus(row.FileCheckStatus),
		FalsePositive:   row.IsVirusFalsePositive,
		CreatorID:       row.CreatorID,
		Created:         row.Created,
		Updated:         row.Updated,
	}
	if resource != nil {
		file.GameID = resource.GameID
		file.ResourceStatus = resource.Status
	}
	return file
}

func toHistory(row *ent.GameDownloadResourceFileHistory) download.History {
	return download.History{
		ID:              row.ID,
		FileID:          row.FileID,
		Size:            row.FileSize,
		HashAlgorithm:   upload.HashAlgorithm(row.HashAlgorithm),
		Hash:            row.FileHash,
		StorageKey:      row.S3FileKey,
		Reason:          row.Reason,
		UploadSessionID: row.UploadSessionID,
		OperatorID:      row.OperatorID,
		Created:         row.Created,
	}
}
