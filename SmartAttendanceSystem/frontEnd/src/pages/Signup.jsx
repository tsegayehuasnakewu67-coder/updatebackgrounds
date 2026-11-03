import { Link } from 'react-router-dom';

export default function Signup() {
  return (
    <main className="signup-restricted">
      <h1>Registration is restricted</h1>
      <p>Please contact your administrator to create an employee account.</p>
      <Link to="/login">Return to login</Link>
    </main>
  );
}
