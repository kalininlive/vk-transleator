import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Overlay from './Overlay';
import AdminPanel from './AdminPanel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;
