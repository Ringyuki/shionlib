import Sidebar from './Sidebar.json'
import Dashboard from './Dashboard.json'
import Games from './Games.json'
import Users from './Users.json'
import Comments from './Comments.json'
import Walkthroughs from './Walkthroughs.json'
import Reports from './Reports.json'
import MalwareScans from './MalwareScans.json'

const messages = {
  Sidebar,
  Dashboard,
  Games,
  Users,
  Comments,
  Walkthroughs,
  Reports,
  MalwareScans,
} as const

export default messages
