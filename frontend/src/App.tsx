import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { CatalogProvider } from './context/CatalogContext';
import { HomePage } from './pages/HomePage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomPage } from './pages/RoomPage';
import { StayPage } from './pages/StayPage';
import { GalleryPage } from './pages/GalleryPage';
import { AccountPage } from './pages/AccountPage';
import { StaffPage } from './pages/StaffPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return <AuthProvider><CatalogProvider><Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="rooms" element={<RoomsPage />} />
    <Route path="rooms/:roomId" element={<RoomPage />} />
    <Route path="stay" element={<StayPage />} />
    <Route path="gallery" element={<GalleryPage />} />
    <Route path="account" element={<AccountPage />} />
    <Route path="staff" element={<StaffPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes></CatalogProvider></AuthProvider>;
}
