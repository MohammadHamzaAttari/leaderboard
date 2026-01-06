import { AuthProvider } from '../context/AuthContext';
import '../styles/globals.css';
import '../styles/Login.module.css';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;