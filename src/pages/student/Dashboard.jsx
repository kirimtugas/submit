import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import Overview from './Overview';
import Tasks from './Tasks';
import Grades from './Grades';

export default function StudentDashboard() {
    return (
        <DashboardLayout>
            <Routes>
                <Route index element={<Overview />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="grades" element={<Grades />} />
            </Routes>
        </DashboardLayout>
    );
}


