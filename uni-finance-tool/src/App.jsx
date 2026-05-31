import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import UniversityPage from './pages/UniversityPage';
import CoursePage from './pages/CoursePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/university/:slug" element={<UniversityPage />} />
      <Route path="/course/:courseId" element={<CoursePage />} />
    </Routes>
  );
}
