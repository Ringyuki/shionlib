package hips

import (
	"strings"
)

const maskedParams = "w=320&blur=48&q=60&f=webp"

type Masker struct {
	processorURL string
	bucketURL    string
}

func NewMasker(processorURL, bucketURL string) *Masker {
	return &Masker{processorURL: strings.TrimSuffix(processorURL, "/"), bucketURL: strings.TrimSuffix(bucketURL, "/")}
}

func (m *Masker) Mask(url string) (string, bool) {
	if m.processorURL == "" || m.bucketURL == "" || strings.ContainsAny(url, "?#") {
		return "", false
	}
	key, ok := strings.CutPrefix(url, m.bucketURL+"/")
	if !ok || key == "" {
		return "", false
	}
	return m.processorURL + "/" + key + "?" + maskedParams, true
}
