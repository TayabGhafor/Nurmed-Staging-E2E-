"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button } from "../../../components";
import { useAuth } from "../../../contexts/AuthContext";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function SignupPage() {
  const { signup, isLoading: authLoading } = useAuth();
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      first_name: "",
      last_name: "",
      email: "",
      address: "",
      organization: "",
      password: "",
      confirm_password: "",
    },
    validationSchema: Yup.object({
      first_name: Yup.string().trim().required("First name is required."),
      last_name: Yup.string().trim().required("Last name is required."),
      email: Yup.string()
        .matches(emailRegex, "Please enter a valid email address.")
        .required("Email is required."),
      address: Yup.string().trim().required("Address is required."),
      organization: Yup.string().trim(),
      password: Yup.string()
        .min(6, "Password must be at least 6 characters long.")
        .required("Password is required."),
      confirm_password: Yup.string()
        .oneOf([Yup.ref("password")], "Passwords do not match.")
        .required("Please confirm your password."),
    }),
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      setError("");
      setSuccessMessage("");
      setIsSubmitting(true);

      const response = await signup({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        organization: values.organization.trim() || undefined,
        password: values.password,
      });

      if (!response.success) {
        setError(response.error || "Failed to create account");
      } else {
        setSuccessMessage(
          response.message ||
            "Your account has been created. Please check your email to verify your account before logging in.",
        );
        formik.resetForm();
      }

      setIsSubmitting(false);
    },
  });

  return (
    <div className="lg:px-22 w-full max-w-[580px] rounded-[10px] bg-white p-8 shadow-lg lg:py-12">
      <div className="mb-8 flex justify-center">
        <Image
          src="/images/logo.png"
          alt="NurMed Logo"
          width={120}
          height={40}
          priority
        />
      </div>

      <h2 className="mb-8 text-center text-[16px] font-normal text-gray-600">
        Create your account
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-md bg-green-100 p-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <input
              type="text"
              name="first_name"
              placeholder="First name"
              value={formik.values.first_name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isSubmitting || authLoading}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
            />
            {formik.touched.first_name && formik.errors.first_name && (
              <div className="mt-1 text-sm text-red-600">{formik.errors.first_name}</div>
            )}
          </div>

          <div>
            <input
              type="text"
              name="last_name"
              placeholder="Last name"
              value={formik.values.last_name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isSubmitting || authLoading}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
            />
            {formik.touched.last_name && formik.errors.last_name && (
              <div className="mt-1 text-sm text-red-600">{formik.errors.last_name}</div>
            )}
          </div>
        </div>

        <div>
          <input
            type="email"
            name="email"
            placeholder="Email address"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isSubmitting || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
          {formik.touched.email && formik.errors.email && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.email}</div>
          )}
        </div>

        <div>
          <input
            type="text"
            name="address"
            placeholder="Address"
            value={formik.values.address}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isSubmitting || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
          {formik.touched.address && formik.errors.address && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.address}</div>
          )}
        </div>

        <div>
          <input
            type="text"
            name="organization"
            placeholder="Organization (optional)"
            value={formik.values.organization}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isSubmitting || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isSubmitting || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
          {formik.touched.password && formik.errors.password && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.password}</div>
          )}
        </div>

        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirm_password"
            placeholder="Confirm password"
            value={formik.values.confirm_password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isSubmitting || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showConfirmPassword ? "Hide" : "Show"}
          </button>
          {formik.touched.confirm_password && formik.errors.confirm_password && (
            <div className="mt-1 text-sm text-red-600">{formik.errors.confirm_password}</div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full rounded-md bg-[#2832A8] py-3 text-[15px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || authLoading}
        >
          {isSubmitting ? "Creating account..." : "Sign up"}
        </Button>
      </form>

      <div className="mt-5 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#2832A8] hover:underline">
          Login
        </Link>
      </div>
    </div>
  );
}
