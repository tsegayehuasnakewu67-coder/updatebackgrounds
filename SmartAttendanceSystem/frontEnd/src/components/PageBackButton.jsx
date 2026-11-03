import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleHome = { admin: '/admin', hr: '/hr', employee: '/me' };

export default function PageBackButton({ fallback }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const goBack = () => {
    const index = window.history.state?.idx;
    if (Number.isInteger(index) && index > 0) {
      navigate(-1);
      return;
    }
    const defaultFallback = user?.mustChangePassword
      ? '/change-password'
      : user ? roleHome[user.role] || '/' : '/';
    navigate(fallback || defaultFallback, { replace: true, state: location.state });
  };

  return (
    <button className="page-back-button" onClick={goBack} type="button">
      <ArrowLeft size={16} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}