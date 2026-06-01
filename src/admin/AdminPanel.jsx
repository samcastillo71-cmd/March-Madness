import { useAuth }         from '../auth/AuthContext';
import { SuperAdminPanel } from './SuperAdminPanel';
import { TeacherPanel }    from './TeacherPanel';

export function AdminPanel(props) {
  const { role, superAdmin } = useAuth();
  if (superAdmin)         return <SuperAdminPanel {...props} />;
  if (role === 'teacher') return <TeacherPanel {...props} />;
  return null;
}
