import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BackToHomeButton({ className = "", children = "Back to Home", type = "button" }) {
  const navigate = useNavigate();

  return (
    <button
      type={type}
      onClick={() => navigate("/app")}
      className={`back-home-button ${className}`.trim()}
    >
      <Home size={18} />
      <span>{children}</span>
    </button>
  );
}
