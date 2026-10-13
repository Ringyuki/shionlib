#!/bin/sh
set -eu

release=v26.02-v1.5.7-R2
target="${1:?usage: install-7zip.sh <directory>}"

case "${TARGETARCH:-$(uname -m)}" in
  amd64 | x86_64)
    asset=linux-gcc-x64.zip
    sum=be246e5a284d3b5e738bad5cbb24c2662996ddb9776e09575b5099ab53fa0ba3
    ;;
  arm64 | aarch64)
    asset=linux-gcc-arm64.zip
    sum=64511f6ebc32d5257a535b33b21a5b6712c72aa91e28524f41e1ce92e803c909
    ;;
  *)
    echo "unsupported architecture ${TARGETARCH:-$(uname -m)}" >&2
    exit 1
    ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl -fsSLo "$work/7z.zip" "https://github.com/mcmilk/7-Zip-zstd/releases/download/$release/$asset"
echo "$sum  $work/7z.zip" | sha256sum -c -
unzip -q "$work/7z.zip" 7zz -d "$work"
install -D -m 0755 "$work/7zz" "$target/7zz"
