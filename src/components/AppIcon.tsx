import type { CSSProperties, ComponentType } from 'react'
import {
  KeyOutlined,
  UserOutlined,
  ProfileOutlined,
  SearchOutlined,
  FileTextOutlined,
  SettingOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  GiftOutlined,
  UploadOutlined,
  ImportOutlined,
  ExportOutlined,
  FileOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  BgColorsOutlined,
  NotificationOutlined,
  RightOutlined,
} from '@ant-design/icons'

export type IconName =
  | 'key'
  | 'user'
  | 'clipboard'
  | 'search'
  | 'scroll'
  | 'settings'
  | 'package'
  | 'check-circle'
  | 'map-pin'
  | 'gift'
  | 'upload'
  | 'import'
  | 'export'
  | 'file'
  | 'lock'
  | 'alert-circle'
  | 'x-circle'
  | 'palette'
  | 'notification'
  | 'arrow-right'

interface AppIconProps {
  name: IconName
  size?: number | string
  className?: string
  style?: CSSProperties
}

const iconMap: Record<IconName, ComponentType<{ style?: CSSProperties; className?: string }>> = {
  key: KeyOutlined,
  user: UserOutlined,
  clipboard: ProfileOutlined,
  search: SearchOutlined,
  scroll: FileTextOutlined,
  settings: SettingOutlined,
  package: InboxOutlined,
  'check-circle': CheckCircleOutlined,
  'map-pin': EnvironmentOutlined,
  gift: GiftOutlined,
  upload: UploadOutlined,
  import: ImportOutlined,
  export: ExportOutlined,
  file: FileOutlined,
  lock: LockOutlined,
  'alert-circle': ExclamationCircleOutlined,
  'x-circle': CloseCircleOutlined,
  palette: BgColorsOutlined,
  notification: NotificationOutlined,
  'arrow-right': RightOutlined,
}

/**
 * 内联图标组件（统一基于 @ant-design/icons）。
 * 尺寸通过 size prop 控制、颜色继承文字色（currentColor），可被主题样式覆盖。
 */
export default function AppIcon({ name, size = 20, className, style }: AppIconProps) {
  const Cmp = iconMap[name]
  return (
    <Cmp
      className={className}
      style={{ flexShrink: 0, fontSize: size, ...style }}
    />
  )
}
