import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useAuth } from "../helpers/useAuth";
import {
  schema,
  postRegister,
} from "../endpoints/auth/register_with_password_POST.schema";
import styles from "./PasswordRegisterForm.module.css";

export type RegisterFormData = z.infer<typeof schema>;

interface PasswordRegisterFormProps {
  className?: string;
  defaultValues?: Partial<RegisterFormData>;
}

export const PasswordRegisterForm: React.FC<PasswordRegisterFormProps> = ({
  className,
  defaultValues,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    schema,
    defaultValues: defaultValues || {
      username: "",
      password: "",
    },
  });

  const handleSubmit = async (data: z.infer<typeof schema>) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postRegister(data);
      console.log("Registration successful for:", data.username);
      onLogin(result.user);
      navigate("/");
    } catch (err) {
      console.error("Registration error:", err);

      if (err instanceof Error) {
        const errorMessage = err.message;

        if (errorMessage.includes("Username already taken")) {
          setError(
            "This username is already taken. Please choose another."
          );
        } else if (errorMessage.toLowerCase().includes("username")) {
          setError("Please provide a valid username: " + errorMessage);
        } else {
          setError(errorMessage || "Registration failed. Please try again.");
        }
      } else {
        console.log("Unknown error type:", err);
        setError("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form
        onSubmit={form.handleSubmit((data) =>
          handleSubmit(data as z.infer<typeof schema>)
        )}
        className={`${styles.form} ${className || ""}`}
      >
        <FormItem name="username">
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input
              placeholder="Enter your username"
              value={form.values.username || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({
                  ...prev,
                  username: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormDescription>
            3-15 characters, letters and numbers only
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Password</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="••••••••"
              value={form.values.password || ""}
              onChange={(e) =>
                form.setValues((prev: any) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormDescription>At least 8 characters</FormDescription>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" /> Creating Account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>
    </Form>
  );
};