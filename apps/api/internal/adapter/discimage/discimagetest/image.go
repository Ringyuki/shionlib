package discimagetest

import (
	"bytes"
	"encoding/binary"
	"slices"
	"strings"
	"unicode/utf16"
)

const (
	Sector       = 2048
	systemArea   = 16
	recordBase   = 33
	primaryKind  = 1
	jolietKind   = 2
	terminator   = 255
	directoryBit = 2
)

type File struct {
	Path string
	Data []byte
}

type Options struct {
	Label       string
	PrimaryOnly bool
	RawLabel    []byte
}

type node struct {
	name     string
	data     []byte
	dir      bool
	children []*node
	extent   [2]uint32
	file     uint32
}

func both32(value uint32) []byte {
	out := make([]byte, 8)
	binary.LittleEndian.PutUint32(out, value)
	binary.BigEndian.PutUint32(out[4:], value)
	return out
}

func both16(value uint16) []byte {
	out := make([]byte, 4)
	binary.LittleEndian.PutUint16(out, value)
	binary.BigEndian.PutUint16(out[2:], value)
	return out
}

func wide(text string) []byte {
	units := utf16.Encode([]rune(text))
	out := make([]byte, len(units)*2)
	for i, unit := range units {
		binary.BigEndian.PutUint16(out[i*2:], unit)
	}
	return out
}

func plainName(name string, dir bool) []byte {
	upper := strings.ToUpper(name)
	if dir {
		return []byte(upper)
	}
	return []byte(upper + ";1")
}

func record(name []byte, extent, size uint32, dir bool) []byte {
	length := recordBase + len(name)
	if length%2 == 1 {
		length++
	}
	out := make([]byte, length)
	out[0] = byte(length)
	copy(out[2:], both32(extent))
	copy(out[10:], both32(size))
	copy(out[18:], []byte{103, 6, 30, 12, 0, 0, 0})
	if dir {
		out[25] = directoryBit
	}
	copy(out[28:], both16(1))
	out[32] = byte(len(name))
	copy(out[33:], name)
	return out
}

func tree(files []File) *node {
	root := &node{dir: true}
	for _, file := range files {
		at := root
		parts := strings.Split(file.Path, "/")
		for i, part := range parts {
			last := i == len(parts)-1
			index := slices.IndexFunc(at.children, func(child *node) bool { return child.name == part })
			if index < 0 {
				at.children = append(at.children, &node{name: part, dir: !last})
				index = len(at.children) - 1
			}
			at = at.children[index]
			if last {
				at.data = file.Data
			}
		}
	}
	return root
}

func walk(root *node, visit func(*node)) {
	visit(root)
	for _, child := range root.children {
		if child.dir {
			walk(child, visit)
		}
	}
}

func directory(self, parent *node, space int) []byte {
	out := make([]byte, 0, Sector)
	out = append(out, record([]byte{0}, self.extent[space], Sector, true)...)
	out = append(out, record([]byte{1}, parent.extent[space], Sector, true)...)
	for _, child := range self.children {
		name := plainName(child.name, child.dir)
		if space == 1 {
			name = wide(child.name)
		}
		if child.dir {
			out = append(out, record(name, child.extent[space], Sector, true)...)
			continue
		}
		out = append(out, record(name, child.file, uint32(len(child.data)), false)...)
	}
	return append(out, make([]byte, Sector-len(out))...)
}

func descriptor(kind byte, label []byte, blocks uint32, root *node, space int) []byte {
	out := make([]byte, Sector)
	out[0] = kind
	copy(out[1:], "CD001")
	out[6] = 1
	for i := 8; i < 72; i++ {
		out[i] = ' '
	}
	if kind == jolietKind {
		copy(out[8:72], bytes.Repeat([]byte{0, ' '}, 32))
		copy(out[88:], "%/E")
	}
	copy(out[40:72], label)
	copy(out[80:], both32(blocks))
	copy(out[120:], both16(1))
	copy(out[124:], both16(1))
	copy(out[128:], both16(Sector))
	copy(out[156:], record([]byte{0}, root.extent[space], Sector, true))
	out[881] = 1
	return out
}

func Build(options Options, files ...File) []byte {
	root := tree(files)
	spaces := 2
	if options.PrimaryOnly {
		spaces = 1
	}
	next := uint32(systemArea + spaces + 1)
	for space := range spaces {
		walk(root, func(dir *node) {
			dir.extent[space] = next
			next++
		})
	}
	var contents []*node
	var collect func(*node)
	collect = func(dir *node) {
		for _, child := range dir.children {
			if child.dir {
				collect(child)
				continue
			}
			child.file = next
			next += uint32((len(child.data) + Sector - 1) / Sector)
			contents = append(contents, child)
		}
	}
	collect(root)
	image := make([]byte, int(next)*Sector)
	label := options.RawLabel
	if label == nil {
		label = []byte(strings.ToUpper(options.Label))
	}
	copy(image[systemArea*Sector:], descriptor(primaryKind, label, next, root, 0))
	if spaces == 2 {
		copy(image[(systemArea+1)*Sector:], descriptor(jolietKind, wide(options.Label), next, root, 1))
	}
	end := image[(systemArea+spaces)*Sector:]
	end[0] = terminator
	copy(end[1:], "CD001")
	end[6] = 1
	for space := range spaces {
		var place func(self, parent *node)
		place = func(self, parent *node) {
			copy(image[int(self.extent[space])*Sector:], directory(self, parent, space))
			for _, child := range self.children {
				if child.dir {
					place(child, self)
				}
			}
		}
		place(root, root)
	}
	for _, file := range contents {
		copy(image[int(file.file)*Sector:], file.data)
	}
	return image
}

func Raw(cooked []byte, sector, data int) []byte {
	count := len(cooked) / Sector
	out := make([]byte, count*sector)
	for i := range count {
		copy(out[i*sector+data:], cooked[i*Sector:(i+1)*Sector])
	}
	return out
}
