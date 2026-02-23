import React, { useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import {
  schema,
  postLogin,
} from "../endpoints/auth/login_with_password_POST.schema";
import { useAuth } from "../helpers/useAuth";
import styles from "./PasswordLoginForm.module.css";

export type LoginFormData = z.infer<typeof schema>;

interface PasswordLoginFormProps {
  className?: string;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    schema,
  });

  const handleSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postLogin(data);
      onLogin(result.user);
      setTimeout(() => navigate("/"), 200);
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="username">
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input
              placeholder="Enter your username"
              type="text"
              autoComplete="username"
              disabled={isLoading}
              value={form.values.username}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  username: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Password</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              value={form.values.password}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <span className={styles.loadingText}>
              <Spinner className={styles.spinner} size="sm" />
              Logging in...
            </span>
          ) : (
            "Log In"
          )}
        </Button>
      </form>
    </Form>
  );
};