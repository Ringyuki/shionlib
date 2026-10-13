package composition

import (
	"time"

	"github.com/Ringyuki/shionlib/apps/api/internal/setting"
)

var (
	MaxUnpackedSize = setting.Bytes(setting.Spec[int64]{
		Name:        "composition.max_unpacked_size",
		Label:       "原版解包后的大小上限",
		Description: "解包后超过这个大小的资源不能作为合成的原版。",
		Default:     40 << 30, Min: 1 << 30, Max: 1 << 40,
	})
	Concurrency = setting.Int(setting.Spec[int]{
		Name:        "composition.concurrency",
		Label:       "同时运行的合成任务数",
		Description: "同一时间最多运行的合成任务数量，其余任务排队等待。",
		Default:     1, Min: 1, Max: MaxConcurrency,
	})
	QueueLimit = setting.Int(setting.Spec[int]{
		Name:        "composition.queue_limit",
		Label:       "合成任务的排队上限",
		Description: "排队等待的合成任务达到这个数量后，不再接受新的合成任务。",
		Default:     20, Min: 1, Max: 1000,
	})
	PackThreads = setting.Int(setting.Spec[int]{
		Name:        "composition.pack_threads",
		Label:       "合成使用的处理器线程数",
		Description: "解包和打包时使用的处理器线程数量。数值越大合成越快，同时占用的处理器和内存越多。",
		Default:     4, Min: 1, Max: 64,
	})
	DraftTTL = setting.Duration(setting.Spec[time.Duration]{
		Name:        "composition.draft_ttl",
		Label:       "未开始的合成的保留时长",
		Description: "已上传补丁但没有开始合成的草稿，超过这个时长无人操作后连同补丁一起清除。",
		Default:     24 * time.Hour, Min: time.Hour, Max: 30 * 24 * time.Hour,
	})
)
