package sitemaphttp

type sitemapEntriesInput struct {
	Section string `path:"section" enum:"game,resource,walkthrough,developer,character,translator" doc:"Kind of page the entries lead to"`
	Page    int    `path:"page" minimum:"1" doc:"1-based page of at most 50,000 entries"`
}
