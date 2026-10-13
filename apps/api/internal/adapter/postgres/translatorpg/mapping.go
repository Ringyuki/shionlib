package translatorpg

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/ent"
	"github.com/Ringyuki/shionlib/apps/api/internal/adapter/postgres/pgvalue"
	"github.com/Ringyuki/shionlib/apps/api/internal/translator"
)

func nonNil(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func toTranslator(row *ent.Translator) translator.Translator {
	return translator.Translator{
		ID:        row.ID,
		Name:      row.Name,
		Aliases:   nonNil(row.Aliases),
		Homepage:  row.Homepage,
		CreatorID: row.CreatorID,
		Created:   row.Created,
		Updated:   row.Updated,
	}
}

func scanCount(rows *sql.Rows) (int, error) {
	var count int
	if rows.Next() {
		if err := rows.Scan(&count); err != nil {
			return 0, err
		}
	}
	return count, rows.Err()
}

func scanSummaries(rows *sql.Rows) ([]translator.Summary, error) {
	summaries := []translator.Summary{}
	for rows.Next() {
		var summary translator.Summary
		var aliases pgvalue.Strings
		if err := rows.Scan(&summary.ID, &summary.Name, &aliases, &summary.WorksCount); err != nil {
			return nil, fmt.Errorf("scan translator summary: %w", err)
		}
		summary.Aliases = nonNil(aliases)
		summaries = append(summaries, summary)
	}
	return summaries, rows.Err()
}

func scanEntries(rows *sql.Rows) ([]translator.AdminEntry, error) {
	entries := []translator.AdminEntry{}
	for rows.Next() {
		var entry translator.AdminEntry
		var aliases pgvalue.Strings
		var homepage sql.NullString
		var latest sql.NullTime
		if err := rows.Scan(&entry.ID, &entry.Name, &aliases, &homepage, &entry.WorksCount, &entry.ResourcesCount, &latest); err != nil {
			return nil, fmt.Errorf("scan translator entry: %w", err)
		}
		entry.Aliases = nonNil(aliases)
		if homepage.Valid {
			entry.Homepage = &homepage.String
		}
		if latest.Valid {
			at := latest.Time.In(time.UTC)
			entry.LatestCredit = &at
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}
