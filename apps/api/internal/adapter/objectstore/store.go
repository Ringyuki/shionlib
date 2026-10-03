package objectstore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"golang.org/x/sync/errgroup"

	"github.com/Ringyuki/shionlib/apps/api/internal/download"
)

const (
	defaultRegion      = "auto"
	defaultPartSize    = 32 << 20
	defaultConcurrency = 4
	deleteBatch        = 1000
)

type Options struct {
	Bucket          string
	Region          string
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	PathStyle       bool
	HTTPClient      *http.Client
	PartSize        int64
	Concurrency     int
}

type Store struct {
	client      *s3.Client
	bucket      string
	partSize    int64
	concurrency int
}

func New(opts Options) *Store {
	if opts.Region == "" {
		opts.Region = defaultRegion
	}
	if opts.PartSize <= 0 {
		opts.PartSize = defaultPartSize
	}
	if opts.Concurrency <= 0 {
		opts.Concurrency = defaultConcurrency
	}
	s3Options := s3.Options{
		Region:                     opts.Region,
		Credentials:                credentials.NewStaticCredentialsProvider(opts.AccessKeyID, opts.SecretAccessKey, ""),
		UsePathStyle:               opts.PathStyle,
		RequestChecksumCalculation: aws.RequestChecksumCalculationWhenRequired,
		ResponseChecksumValidation: aws.ResponseChecksumValidationWhenRequired,
	}
	if opts.Endpoint != "" {
		s3Options.BaseEndpoint = aws.String(opts.Endpoint)
	}
	if opts.HTTPClient != nil {
		s3Options.HTTPClient = opts.HTTPClient
	}
	return &Store{client: s3.New(s3Options), bucket: opts.Bucket, partSize: opts.PartSize, concurrency: opts.Concurrency}
}

func (s *Store) Put(ctx context.Context, object download.Object) error {
	file, err := os.Open(object.LocalPath)
	if err != nil {
		return fmt.Errorf("open %s for upload: %w", object.LocalPath, err)
	}
	defer func() { _ = file.Close() }()
	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat %s for upload: %w", object.LocalPath, err)
	}
	if info.Size() <= s.partSize {
		_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:        aws.String(s.bucket),
			Key:           aws.String(object.Key),
			Body:          file,
			ContentLength: aws.Int64(info.Size()),
			ContentType:   aws.String(object.ContentType),
			Metadata:      object.Metadata,
		})
		if err != nil {
			return fmt.Errorf("put object %s: %w", object.Key, err)
		}
		return nil
	}
	return s.putMultipart(ctx, object, file, info.Size())
}

func (s *Store) putMultipart(ctx context.Context, object download.Object, file io.ReaderAt, size int64) error {
	created, err := s.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(object.Key),
		ContentType: aws.String(object.ContentType),
		Metadata:    object.Metadata,
	})
	if err != nil {
		return fmt.Errorf("create multipart upload %s: %w", object.Key, err)
	}
	count := int((size + s.partSize - 1) / s.partSize)
	parts := make([]types.CompletedPart, count)
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(s.concurrency)
	for i := range count {
		offset := int64(i) * s.partSize
		length := min(s.partSize, size-offset)
		number := aws.Int32(int32(i + 1))
		group.Go(func() error {
			out, err := s.client.UploadPart(groupCtx, &s3.UploadPartInput{
				Bucket:        aws.String(s.bucket),
				Key:           aws.String(object.Key),
				UploadId:      created.UploadId,
				PartNumber:    number,
				Body:          io.NewSectionReader(file, offset, length),
				ContentLength: aws.Int64(length),
			})
			if err != nil {
				return fmt.Errorf("upload part %d of %s: %w", *number, object.Key, err)
			}
			parts[i] = types.CompletedPart{ETag: out.ETag, PartNumber: number}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return errors.Join(err, s.abort(ctx, object.Key, created.UploadId))
	}
	_, err = s.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:          aws.String(s.bucket),
		Key:             aws.String(object.Key),
		UploadId:        created.UploadId,
		MultipartUpload: &types.CompletedMultipartUpload{Parts: parts},
	})
	if err != nil {
		return errors.Join(fmt.Errorf("complete multipart upload %s: %w", object.Key, err), s.abort(ctx, object.Key, created.UploadId))
	}
	return nil
}

func (s *Store) abort(ctx context.Context, key string, uploadID *string) error {
	_, err := s.client.AbortMultipartUpload(context.WithoutCancel(ctx), &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(s.bucket),
		Key:      aws.String(key),
		UploadId: uploadID,
	})
	if err != nil {
		return fmt.Errorf("abort multipart upload %s: %w", key, err)
	}
	return nil
}

func (s *Store) Delete(ctx context.Context, key string) error {
	return s.deleteVersions(ctx, key, func(*time.Time) bool { return true })
}

func (s *Store) DeleteVersionsBefore(ctx context.Context, key string, before time.Time) error {
	return s.deleteVersions(ctx, key, func(modified *time.Time) bool {
		return modified != nil && !modified.After(before)
	})
}

func (s *Store) deleteVersions(ctx context.Context, key string, keep func(modified *time.Time) bool) error {
	var targets []types.ObjectIdentifier
	input := &s3.ListObjectVersionsInput{Bucket: aws.String(s.bucket), Prefix: aws.String(key)}
	for {
		out, err := s.client.ListObjectVersions(ctx, input)
		if err != nil {
			return fmt.Errorf("list versions of %s: %w", key, err)
		}
		for _, version := range out.Versions {
			if aws.ToString(version.Key) == key && keep(version.LastModified) {
				targets = append(targets, types.ObjectIdentifier{Key: aws.String(key), VersionId: version.VersionId})
			}
		}
		for _, marker := range out.DeleteMarkers {
			if aws.ToString(marker.Key) == key && keep(marker.LastModified) {
				targets = append(targets, types.ObjectIdentifier{Key: aws.String(key), VersionId: marker.VersionId})
			}
		}
		if !aws.ToBool(out.IsTruncated) {
			break
		}
		input.KeyMarker = out.NextKeyMarker
		input.VersionIdMarker = out.NextVersionIdMarker
	}
	for start := 0; start < len(targets); start += deleteBatch {
		batch := targets[start:min(start+deleteBatch, len(targets))]
		out, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(s.bucket),
			Delete: &types.Delete{Objects: batch, Quiet: aws.Bool(true)},
		})
		if err != nil {
			return fmt.Errorf("delete versions of %s: %w", key, err)
		}
		if len(out.Errors) > 0 {
			first := out.Errors[0]
			return fmt.Errorf("delete versions of %s: %d failed, first %s: %s", key, len(out.Errors), aws.ToString(first.Code), aws.ToString(first.Message))
		}
	}
	return nil
}

func (s *Store) List(ctx context.Context) (download.Listing, error) {
	out, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{Bucket: aws.String(s.bucket)})
	if err != nil {
		return download.Listing{}, fmt.Errorf("list objects: %w", err)
	}
	listing := download.Listing{
		Name:                  aws.ToString(out.Name),
		Prefix:                aws.ToString(out.Prefix),
		KeyCount:              int(aws.ToInt32(out.KeyCount)),
		MaxKeys:               int(aws.ToInt32(out.MaxKeys)),
		IsTruncated:           aws.ToBool(out.IsTruncated),
		ContinuationToken:     aws.ToString(out.ContinuationToken),
		NextContinuationToken: aws.ToString(out.NextContinuationToken),
		Objects:               make([]download.ObjectInfo, 0, len(out.Contents)),
	}
	for _, object := range out.Contents {
		listing.Objects = append(listing.Objects, download.ObjectInfo{
			Key:          aws.ToString(object.Key),
			LastModified: object.LastModified,
			ETag:         aws.ToString(object.ETag),
			Size:         aws.ToInt64(object.Size),
			StorageClass: string(object.StorageClass),
		})
	}
	return listing, nil
}
