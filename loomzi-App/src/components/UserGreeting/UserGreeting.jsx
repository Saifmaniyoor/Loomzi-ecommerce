
import { useEffect, useState } from "react";

function UserGreeting() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/me",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user);

      } catch (error) {
        console.error("Fetch user error:", error);
      }
    };

    fetchUser();
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="user-greeting">
      <span>Hi, {user.fullName}! 👋</span>
    </div>
  );
}

export default UserGreeting;
