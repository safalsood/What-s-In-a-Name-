import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, LogOut, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  postChangePassword,
  schema as changePasswordEndpointSchema,
} from "../endpoints/auth/change-password_POST.schema";
import { useAuth } from "../helpers/useAuth";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import styles from "./SettingsAccountCard.module.css";
// We don't have the change password endpoint yet, so we'll mock it for now or just log it
// The user prompt says "call a new endpoint (we'll create it separately)", implying I should probably just set up the UI and maybe a placeholder function.
// However, typically I shouldn't leave dead code. I'll just simulate the call or leave a TODO.
// actually, I can just fetch to a path that I expect to exist or will exist.
// But better yet, I will just implement the client side logic and show a toast for now as per instructions "call a new endpoint (we'll create it separately)" might mean I don't need to implement the endpoint file but I should probably try to call it.
// Let's assume the endpoint will be POST /_api/auth/change-password.

const changePasswordFormSchema = changePasswordEndpointSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const SettingsAccountCard = () => {
  const { authState, logout } = useAuth();
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const form = useForm({
    schema: changePasswordFormSchema,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  const onChangePassword = async (
    values: z.infer<typeof changePasswordFormSchema>,
  ) => {
    try {
      setIsChangingPassword(true);
      await postChangePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      toast.success("Password changed successfully");
      form.setValues({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authState.type === "loading") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <User
              size={24}
              style={{
                display: "inline-block",
                verticalAlign: "middle",
                marginRight: "0.75rem",
                color: "var(--primary)",
              }}
            />
            Account
          </h2>
        </div>
        <div className={styles.loadingState}>Loading account details...</div>
      </div>
    );
  }

  if (authState.type === "unauthenticated") {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <User
              size={24}
              style={{
                display: "inline-block",
                verticalAlign: "middle",
                marginRight: "0.75rem",
                color: "var(--primary)",
              }}
            />
            Account
          </h2>
        </div>
        <div className={styles.unauthenticatedState}>
          <p className={styles.description}>
            Sign in to save your progress and compete with others.
          </p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { user } = authState;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>
          <User
            size={24}
            style={{
              display: "inline-block",
              verticalAlign: "middle",
              marginRight: "0.75rem",
              color: "var(--primary)",
            }}
          />
          Account
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className={styles.logoutButton}
        >
          <LogOut size={16} />
          Log Out
        </Button>
      </div>

      <div className={styles.userInfo}>
        <div className={styles.userAvatar}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} />
          ) : (
            <User size={32} />
          )}
        </div>
        <div className={styles.userDetails}>
          <span className={styles.username}>{user.username}</span>
          <span className={styles.userRole}>{user.role || "Player"}</span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.changePasswordSection}>
        <h3 className={styles.subTitle}>
          <Lock size={16} />
          Change Password
        </h3>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onChangePassword)}
            className={styles.form}
          >
            <FormItem name="currentPassword">
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter current password"
                  value={form.values.currentPassword}
                  onChange={(e) =>
                    form.setValues((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <div className={styles.newPasswordGrid}>
              <FormItem name="newPassword">
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Min 8 chars"
                    value={form.values.newPassword}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="confirmPassword">
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={form.values.confirmPassword}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>

            <div className={styles.formActions}>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className={styles.saveButton}
              >
                <Save size={16} />
                {isChangingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};