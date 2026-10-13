package composition

import (
	"path"
	"strings"
)

type Node struct {
	Path string
	Size int64
	Dir  bool
}

type Move struct {
	From string
	To   string
}

type Unpacking struct {
	Archive     string
	Destination string
	Threads     int
}

type Packing struct {
	Root    string
	Entries []string
	Target  string
	Threads int
}

func Resolve(nodes []Node, wanted string) (string, bool) {
	if wanted == Root {
		return Root, true
	}
	key := Key(wanted)
	for _, node := range nodes {
		if node.Dir && Key(node.Path) == key {
			return node.Path, true
		}
	}
	return "", false
}

func Under(nodes []Node, dir string) []Node {
	if dir == Root {
		return nodes
	}
	inside := []Node{}
	for _, node := range nodes {
		if rest, ok := Within(dir, node.Path); ok {
			inside = append(inside, Node{Path: rest, Size: node.Size, Dir: node.Dir})
		}
	}
	return inside
}

func Tops(nodes []Node) []Node {
	tops := []Node{}
	for _, node := range nodes {
		if !strings.Contains(node.Path, "/") {
			tops = append(tops, node)
		}
	}
	return tops
}

func Overlay(game, patch []Node) ([]Move, []string) {
	known := make(map[string]Node, len(game))
	for _, node := range game {
		known[Key(node.Path)] = node
	}
	moves := []Move{}
	conflicts := []string{}
	for _, node := range patch {
		if node.Dir {
			continue
		}
		target, ok := place(known, node.Path)
		if !ok {
			conflicts = append(conflicts, node.Path)
			continue
		}
		moves = append(moves, Move{From: node.Path, To: target})
	}
	return moves, conflicts
}

func place(known map[string]Node, name string) (string, bool) {
	parts := splitPath(name)
	placed := Root
	for i, part := range parts {
		last := i == len(parts)-1
		wanted := path.Join(placed, part)
		existing, found := known[Key(wanted)]
		switch {
		case found && existing.Dir == last:
			return "", false
		case found:
			placed = existing.Path
		default:
			placed = wanted
			known[Key(wanted)] = Node{Path: wanted, Dir: !last}
		}
	}
	return placed, true
}
