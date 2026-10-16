
import { useEffect, useState } from "react";
import {
  FaUser,
  FaLock,
  FaSave,
} from "react-icons/fa";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "../../services/profileApi";

import "./Profile.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Profile() {
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
  });

  const [showPasswords, setShowPasswords] = useState({
  currentPassword: false,
  newPassword: false,
  confirmPassword: false,
});

const togglePasswordVisibility = (field) => {
  setShowPasswords((previous) => ({
    ...previous,
    [field]: !previous[field],
  }));
};

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Load profile details
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await getProfile();

        setProfile({
          fullName: data.user.fullName || "",
          email: data.user.email || "",
          phone: data.user.phone || "",
        });
      } catch (error) {
        setProfileError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));

    setProfileError("");
    setProfileMessage("");
  };

  // Save profile
  const handleSaveProfile = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setProfileError("");
      setProfileMessage("");

      const data = await updateProfile({
        fullName: profile.fullName,
        phone: profile.phone,
      });

      setProfile({
        fullName: data.user.fullName,
        email: data.user.email,
        phone: data.user.phone,
      });

      setProfileMessage("Profile updated successfully!");

      window.dispatchEvent(
        new Event("loomzi:profile-updated")
      );
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswords((previous) => ({
      ...previous,
      [name]: value,
    }));

    setPasswordError("");
    setPasswordMessage("");
  };

  // Change password
  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (
      passwords.newPassword !==
      passwords.confirmPassword
    ) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError("");
      setPasswordMessage("");

      const data = await changePassword(passwords);

      setPasswordMessage(data.message);

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <p>Loading profile...</p>;
  }

  return (
    <div className="profile-page">
      <div className="profile-page-heading">
        <h1>My Profile</h1>
        <p>
          Manage your personal information and account security.
        </p>
      </div>

      {/* Personal Information */}
      <section className="profile-card">
        <div className="profile-card-heading">
          <FaUser />
          <h2>Personal Information</h2>
        </div>

        <form onSubmit={handleSaveProfile}>
          <div className="profile-form-grid">
            <div className="profile-form-group">
              <label htmlFor="profile-fullname">
                Full Name
              </label>

              <input
                id="profile-fullname"
                type="text"
                name="fullName"
                value={profile.fullName}
                onChange={handleProfileChange}
                required
                minLength={2}
              />
            </div>

            <div className="profile-form-group">
              <label htmlFor="profile-email">
                Email Address
              </label>

              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
              />
            </div>

            <div className="profile-form-group">
              <label htmlFor="profile-phone">
                Phone Number
              </label>

              <input
                id="profile-phone"
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleProfileChange}
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
              />
            </div>
          </div>

          {profileError && (
            <p className="profile-error" role="alert">
              {profileError}
            </p>
          )}

          {profileMessage && (
            <p className="profile-success" role="status">
              {profileMessage}
            </p>
          )}

          <button
            type="submit"
            className="profile-primary-button"
            disabled={saving}
          >
            <FaSave />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </section>

      {/* Change Password */}
      <section className="profile-card">
        <div className="profile-card-heading">
          <FaLock />
          <h2>Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword}>
          
<div className="profile-form-group">
  <label htmlFor="current-password">
    Current Password
  </label>

  <div className="profile-password-input">
    <input
      id="current-password"
      type={
        showPasswords.currentPassword
          ? "text"
          : "password"
      }
      name="currentPassword"
      value={passwords.currentPassword}
      onChange={handlePasswordChange}
      autoComplete="current-password"
      required
    />

    <button
      type="button"
      className="profile-password-toggle"
      onClick={() =>
        togglePasswordVisibility("currentPassword")
      }
      aria-label={
        showPasswords.currentPassword
          ? "Hide current password"
          : "Show current password"
      }
      aria-pressed={showPasswords.currentPassword}
    >
      {showPasswords.currentPassword ? (
        <FaEyeSlash />
      ) : (
        <FaEye />
      )}
    </button>
  </div>
</div>

<div className="profile-password-grid">
  <div className="profile-form-group">
    <label htmlFor="new-password">
      New Password
    </label>

    <div className="profile-password-input">
      <input
        id="new-password"
        type={
          showPasswords.newPassword
            ? "text"
            : "password"
        }
        name="newPassword"
        value={passwords.newPassword}
        onChange={handlePasswordChange}
        autoComplete="new-password"
        minLength={8}
        required
      />

      <button
        type="button"
        className="profile-password-toggle"
        onClick={() =>
          togglePasswordVisibility("newPassword")
        }
        aria-label={
          showPasswords.newPassword
            ? "Hide new password"
            : "Show new password"
        }
        aria-pressed={showPasswords.newPassword}
      >
        {showPasswords.newPassword ? (
          <FaEyeSlash />
        ) : (
          <FaEye />
        )}
      </button>
    </div>
  </div>

  <div className="profile-form-group">
    <label htmlFor="confirm-password">
      Confirm New Password
    </label>

    <div className="profile-password-input">
      <input
        id="confirm-password"
        type={
          showPasswords.confirmPassword
            ? "text"
            : "password"
        }
        name="confirmPassword"
        value={passwords.confirmPassword}
        onChange={handlePasswordChange}
        autoComplete="new-password"
        minLength={8}
        required
      />

      <button
        type="button"
        className="profile-password-toggle"
        onClick={() =>
          togglePasswordVisibility("confirmPassword")
        }
        aria-label={
          showPasswords.confirmPassword
            ? "Hide confirm password"
            : "Show confirm password"
        }
        aria-pressed={showPasswords.confirmPassword}
      >
        {showPasswords.confirmPassword ? (
          <FaEyeSlash />
        ) : (
          <FaEye />
        )}
      </button>
    </div>
  </div>
</div>

        </form>
      </section>
    </div>
  );
}

export default Profile;
