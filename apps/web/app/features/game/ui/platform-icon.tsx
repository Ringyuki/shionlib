import type { ComponentType } from 'react'
import { BsNintendoSwitch } from 'react-icons/bs'
import { FaAndroid, FaLinux } from 'react-icons/fa'
import { MdAlbum, MdWindow } from 'react-icons/md'
import {
  SiIos,
  SiMacos,
  SiPlaystation3,
  SiPlaystation4,
  SiPlaystationportable,
  SiPlaystationvita,
} from 'react-icons/si'
import type { Platform } from '../game'

const icons: Record<Platform, ComponentType<{ 'aria-hidden'?: boolean }>> = {
  win: MdWindow,
  mac: SiMacos,
  ios: SiIos,
  and: FaAndroid,
  lin: FaLinux,
  ps3: SiPlaystation3,
  ps4: SiPlaystation4,
  psv: SiPlaystationvita,
  psp: SiPlaystationportable,
  swi: BsNintendoSwitch,
  dvd: MdAlbum,
}

export function PlatformIcon({ platform }: { platform: Platform }) {
  const Icon = icons[platform]
  return <Icon aria-hidden />
}
