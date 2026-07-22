import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Submit from './routes/Submit'
import Confirm from './routes/Confirm'
import Board from './routes/Board'
import Manage from './routes/Manage'
import Admin from './routes/Admin'
import Recover from './routes/Recover'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Submit />} />
        <Route path="/confirm/:token" element={<Confirm />} />
        <Route path="/board" element={<Board />} />
        <Route path="/manage/:token" element={<Manage />} />
        <Route path="/recover" element={<Recover />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
