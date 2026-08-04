const handleLogout = () => {  // Define the logout function
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userType');
    localStorage.removeItem('partyName');
    window.location.href = '/';
};

const fetchUserPoints = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('No authentication token found');
    }
    const response = await fetch(process.env.REACT_APP_API_URL + '/api/user/points', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.status === 401) {  // Check if the status is 401 (Unauthorized)
        handleLogout();  // Force logout if unauthorized
        throw new Error('Unauthorized. Redirecting to login.');
    }
    if (!response.ok) {
        throw new Error('Failed to fetch user points');
    }
    return response.json();
};

export default fetchUserPoints;
