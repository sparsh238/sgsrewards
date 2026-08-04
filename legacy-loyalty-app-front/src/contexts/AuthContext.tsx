import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
    auth: { 
        token: string | null, 
        isAuthenticated: boolean, 
        username: string | null, 
        userType: string | null, 
        partyName: string | null 
    };
    login: (token: string, username: string, userType: string, partyName: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const [auth, setAuth] = useState<{ token: string | null, isAuthenticated: boolean, username: string | null, userType: string | null, partyName: string | null }>({
        token: localStorage.getItem('token'),
        isAuthenticated: !!localStorage.getItem('token'),
        username: localStorage.getItem('username'),
        userType: localStorage.getItem('userType'),
        partyName: localStorage.getItem('partyName')
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUsername = localStorage.getItem('username');
        const storedUserType = localStorage.getItem('userType');
        const storedPartyName = localStorage.getItem('partyName');
        if (storedToken && storedUsername && storedUserType && storedPartyName) {
            setAuth({ token: storedToken, isAuthenticated: true, username: storedUsername, userType: storedUserType, partyName: storedPartyName });
        }
        setLoading(false);
    }, []);

    const login = (token: string, username: string, userType: string, partyName: string) => {
        localStorage.setItem('token', token);
        localStorage.setItem('username', username);
        localStorage.setItem('userType', userType);
        localStorage.setItem('partyName', partyName);
        setAuth({ token, isAuthenticated: true, username, userType, partyName });
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userType');
        localStorage.removeItem('partyName');
        setAuth({ token: null, isAuthenticated: false, username: null, userType: null, partyName: null });
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
