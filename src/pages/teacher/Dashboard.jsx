import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import Overview from './Overview';
import Classes from './Classes';
import Students from './Students';
import Tasks from './Tasks';
import Gradebook from './Gradebook';

export default function TeacherDashboard() {
    return (
        <DashboardLayout>
            <Routes>
                <Route index element={<Overview />} />
                <Route path="classes" element={<Classes />} />
                <Route path="students" element={<Students />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="gradebook" element={<Gradebook />} />
            </Routes>
        </DashboardLayout>
    );
}
