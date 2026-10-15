package aiwalkthrough

import (
	"strconv"
	"strings"

	"github.com/Ringyuki/shionlib/apps/api/internal/walkthrough"
)

const instructions = `你把玩家粘贴的视觉小说（galgame）攻略原文整理成结构化的攻略。

总的要求：
1. 只整理，不改写、不翻译、不增删。选项、说明、结局名照抄原文，括号里的原文也保留；逐字照抄，日文汉字和繁体字不转换成简体，标点也不改。
2. 按原文的顺序输出。

note：与具体线路无关的说明，每段一项，例如进入某个篇章的方法。只解释记号的话（如「Save 代表存档点，Load 代表读取存档」）不保留。没有就输出空数组。

routes：每个结局一条线路，按原文的顺序。
- 原文把几位角色写在同一个标题下（如「日紫喜 莺、仓桥 圣衣良」）时，按结局拆开：标题之后到第一个结局是第一条线路，之后每段从读档开始、到下一个结局为止的内容各是一条线路。
- 各线路共用的步骤不单独成线，照原文留在它所在的线路里；后面的线路照原文从读档开始。
- characters：这条线路攻略的角色在角色表中的编号。角色表列出每个角色的各种名字（日文原名、中文译名、英文名、别名），原文可能用其中任何一种，也可能只写名字或简称（如「莺」「灯华」）。只填角色表中有的编号，对应不上就不填。
- name：线路已对应到角色、且原文的标题就是这些角色的名字时，输出空字符串，页面会显示角色名。否则照抄原文的线路标题，如「ハーレム」「真结局」。
- requires：须先通关哪些线路才开放这条线路，填那些线路在本次输出中的序号（第一条是 1）。只有原文写明须先通关时才填，从某个存档读档开始不算开放条件。没有就输出空数组。
- condition：其他开放条件，照抄原文；没有就输出空字符串。
- ending：结局名，照抄原文，如「灯华 END」「TRUE END」；没有就输出空字符串。结局名不再写成步骤。
- steps：这条线路的步骤，每步一个字符串：
  - 选项：照抄选项原文。原文标出好感对象或选项去向的（如「说不要去（行くなと言う） │ 灯华」），把它写在「 | 」之后：「说不要去（行くなと言う） | 灯华」。
  - 存档：「save 01」，编号照抄原文的数字和位数。
  - 读档：「load 01」。
  - 备注：以「# 」开头，如「# 【After篇】共通・灯华路线」。线路中的「※」说明、「【After篇】」一类的分段标记和场景提示都写成备注。
  - 空字符串表示两组步骤之间的停顿，一般不用。
  - 只用来引出存档、读档的记号（如「◆」）不保留。

长度上限：选项和备注每步 300 字，「 | 」之后 100 字，name 80 字，ending 100 字，condition 300 字；最多 60 条线路，每条线路最多 500 步，每条线路最多 12 个角色。`

func input(request walkthrough.FormatRequest) string {
	var b strings.Builder
	b.WriteString("角色表：\n")
	if len(request.Cast) == 0 {
		b.WriteString("（无）\n")
	}
	for _, member := range request.Cast {
		b.WriteString(strconv.Itoa(member.ID))
		b.WriteString("：")
		b.WriteString(strings.Join(member.Names, "；"))
		b.WriteString("\n")
	}
	b.WriteString("\n攻略原文：\n")
	b.WriteString(request.Text)
	return b.String()
}
