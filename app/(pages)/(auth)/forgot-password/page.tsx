"use client";

import Image from "next/image";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Button } from "../../../components";
import { useRouter } from "next/navigation";
import { authService } from "../../../kyClient/auth";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function ForgetPassword() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: "",
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .matches(emailRegex, "Please enter a valid email address.")
        .required("Email is required"),
    }),
    onSubmit: async (values) => {
      setError("");
      setIsLoading(true);
      setSuccess(false);

      const response = await authService.forgotPassword(values.email);
      
      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.error || "Failed to send reset instructions");
      }
      
      setIsLoading(false);
    },
  });

  return (
    <div className="lg:px-22 w-full max-w-[580px] rounded-[20px] bg-white p-8 shadow-lg lg:py-12">
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
        Reset your password
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success ? (
        <div className="text-center">
          <div className="mb-4 rounded-md bg-green-100 p-3 text-sm text-green-700">
            Reset password instructions have been sent to your email.
          </div>
          {/* <Button
            onClick={() => router.push("/auth/verify-otp")}
            className="w-full rounded-md bg-[#2832A8] py-3 text-[15px] font-medium text-white transition-colors"
          >
            Verify OTP
          </Button> */}
        </div>
      ) : (
        <form onSubmit={formik.handleSubmit} className="space-y-5">
          <div>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
              disabled={isLoading}
            />
            {formik.touched.email && formik.errors.email && (
              <div className="mt-1 text-sm text-red-600">
                {formik.errors.email}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full rounded-md bg-[#2832A8] py-3 text-[15px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Reset Password"}
          </Button>
        </form>
      )}
    </div>
  );
}
