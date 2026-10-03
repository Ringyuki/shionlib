package s3store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"

	"github.com/Ringyuki/shionlib/apps/api/internal/platform/config"
)

const (
	DefaultPartSize = 32 << 20
	maxParts        = 10000
	abortTimeout    = 30 * time.Second
)

var ErrNotConfigured = errors.New("object storage bucket is not configured")

type Options struct {
	Bucket     config.Bucket
	HTTPClient *http.Client
	PathStyle  bool
	PartSize   int64
}

type Object struct {
	Key          string
	Size         int64
	LastModified time.Time
}

type Bucket struct {
	client   *s3.Client
	name     string
	partSize int64
}

func New(opts Options) *Bucket {
	partSize := opts.PartSize
	if partSize <= 0 {
		partSize = DefaultPartSize
	}
	s3Options := s3.Options{
		Region:                     opts.Bucket.Region,
		Credentials:                credentials.NewStaticCredentialsProvider(opts.Bucket.AccessKeyID, opts.Bucket.SecretAccessKey, ""),
		UsePathStyle:               opts.PathStyle,
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
	}
	if opts.Bucket.Endpoint != "" {
		s3Options.BaseEndpoint = aws.String(opts.Bucket.Endpoint)
	}
	if opts.HTTPClient != nil {
		s3Options.HTTPClient = opts.HTTPClient
	}
	return &Bucket{client: s3.New(s3Options), name: opts.Bucket.Bucket, partSize: partSize}
}

func (b *Bucket) Upload(ctx context.Context, key, contentType string, body io.Reader) error {
	if b.name == "" {
		return ErrNotConfigured
	}
	buffer := make([]byte, b.partSize)
	n, err := io.ReadFull(body, buffer)
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		_, putErr := b.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:        aws.String(b.name),
			Key:           aws.String(key),
			Body:          bytes.NewReader(buffer[:n]),
			ContentLength: aws.Int64(int64(n)),
			ContentType:   aws.String(contentType),
		})
		if putErr != nil {
			return fmt.Errorf("put object %s: %w", key, putErr)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("read upload body for %s: %w", key, err)
	}
	return b.multipart(ctx, key, contentType, body, buffer)
}

func (b *Bucket) multipart(ctx context.Context, key, contentType string, body io.Reader, buffer []byte) error {
	created, err := b.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(b.name),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("create multipart upload %s: %w", key, err)
	}
	uploadID := created.UploadId
	var parts []types.CompletedPart
	size := len(buffer)
	last := false
	for number := int32(1); ; number++ {
		if number > maxParts {
			return b.abort(ctx, key, uploadID, fmt.Errorf("upload %s exceeds %d parts", key, maxParts))
		}
		part, err := b.client.UploadPart(ctx, &s3.UploadPartInput{
			Bucket:        aws.String(b.name),
			Key:           aws.String(key),
			UploadId:      uploadID,
			PartNumber:    aws.Int32(number),
			Body:          bytes.NewReader(buffer[:size]),
			ContentLength: aws.Int64(int64(size)),
		})
		if err != nil {
			return b.abort(ctx, key, uploadID, fmt.Errorf("upload part %d of %s: %w", number, key, err))
		}
		parts = append(parts, types.CompletedPart{ETag: part.ETag, PartNumber: aws.Int32(number)})
		if last {
			break
		}
		size, err = io.ReadFull(body, buffer)
		if errors.Is(err, io.EOF) {
			break
		}
		if errors.Is(err, io.ErrUnexpectedEOF) {
			last = true
			continue
		}
		if err != nil {
			return b.abort(ctx, key, uploadID, fmt.Errorf("read upload body for %s: %w", key, err))
		}
	}
	if _, err := b.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:          aws.String(b.name),
		Key:             aws.String(key),
		UploadId:        uploadID,
		MultipartUpload: &types.CompletedMultipartUpload{Parts: parts},
	}); err != nil {
		return b.abort(ctx, key, uploadID, fmt.Errorf("complete multipart upload %s: %w", key, err))
	}
	return nil
}

func (b *Bucket) abort(ctx context.Context, key string, uploadID *string, cause error) error {
	abortCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), abortTimeout)
	defer cancel()
	if _, err := b.client.AbortMultipartUpload(abortCtx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(b.name),
		Key:      aws.String(key),
		UploadId: uploadID,
	}); err != nil {
		return errors.Join(cause, fmt.Errorf("abort multipart upload %s: %w", key, err))
	}
	return cause
}

func (b *Bucket) List(ctx context.Context, prefix string) ([]Object, error) {
	if b.name == "" {
		return nil, ErrNotConfigured
	}
	var objects []Object
	pages := s3.NewListObjectsV2Paginator(b.client, &s3.ListObjectsV2Input{Bucket: aws.String(b.name), Prefix: aws.String(prefix)})
	for pages.HasMorePages() {
		page, err := pages.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("list objects under %s: %w", prefix, err)
		}
		for _, item := range page.Contents {
			key := aws.ToString(item.Key)
			if !strings.HasPrefix(key, prefix) {
				continue
			}
			objects = append(objects, Object{Key: key, Size: aws.ToInt64(item.Size), LastModified: aws.ToTime(item.LastModified)})
		}
	}
	return objects, nil
}

func (b *Bucket) Delete(ctx context.Context, key string) error {
	if b.name == "" {
		return ErrNotConfigured
	}
	if _, err := b.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(b.name), Key: aws.String(key)}); err != nil {
		return fmt.Errorf("delete object %s: %w", key, err)
	}
	return nil
}

func (b *Bucket) Get(ctx context.Context, key string, maxBytes int64) ([]byte, string, error) {
	if b.name == "" {
		return nil, "", ErrNotConfigured
	}
	out, err := b.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(b.name), Key: aws.String(key)})
	if err != nil {
		return nil, "", fmt.Errorf("get object %s: %w", key, err)
	}
	defer func() {
		_ = out.Body.Close()
	}()
	if aws.ToInt64(out.ContentLength) > maxBytes {
		return nil, "", fmt.Errorf("object %s is larger than %d bytes", key, maxBytes)
	}
	data, err := io.ReadAll(io.LimitReader(out.Body, maxBytes+1))
	if err != nil {
		return nil, "", fmt.Errorf("read object %s: %w", key, err)
	}
	if int64(len(data)) > maxBytes {
		return nil, "", fmt.Errorf("object %s is larger than %d bytes", key, maxBytes)
	}
	return data, aws.ToString(out.ContentType), nil
}
