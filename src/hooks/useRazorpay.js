// useRazorpay.js
import { useState, useCallback } from "react";
import { createEnrollmentWithPayment } from "../firebase/services";
import { RAZORPAY_KEY_ID } from "../firebase";

/**
 * Custom hook to handle Razorpay payments
 * @param {object} currentUser - Firebase user object
 * @param {function} onPaymentSuccess - Callback after successful payment
 */
const useRazorpay = (currentUser, onPaymentSuccess) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load Razorpay SDK dynamically
  const loadScript = useCallback((src) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Initialize Razorpay payment
  const initializePayment = useCallback(
    async (paymentDetails) => {
      if (!currentUser || !RAZORPAY_KEY_ID) {
        setError("Authentication or Razorpay Key is missing.");
        return false;
      }

      setIsLoading(true);
      setError(null);

      const sdkLoaded = await loadScript(
        "https://checkout.razorpay.com/v1/checkout.js"
      );

      if (!sdkLoaded) {
        setError(
          "Razorpay SDK failed to load. Check your internet connection."
        );
        setIsLoading(false);
        return false;
      }

      const amountInPaise = Math.round(Number(paymentDetails.amount) * 100);

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency: "INR",
        name: "JNTU-GV Certification",
        description: `Enrollment for ${paymentDetails.courseTitle}`,
        image: "YOUR_COURSE_LOGO_URL",
        order_id: paymentDetails.orderId || "",

        handler: async (response) => {
          try {
            const result = await createEnrollmentWithPayment(
              {
                userId: currentUser.uid,
                courseId: paymentDetails.courseId,
                courseTitle: paymentDetails.courseTitle,
                status: "SUCCESS",
                paymentData: {
                  paymentId: response.razorpay_payment_id,
                  amount: paymentDetails.amount,
                },
              },
              {
                userId: currentUser.uid,
                courseId: paymentDetails.courseId,
                courseTitle: paymentDetails.courseTitle,
                amount: paymentDetails.amount,
                currency: "INR",
                status: "captured",
                razorpayData: {
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  signature: response.razorpay_signature,
                },
              }
            );

            if (result.success && onPaymentSuccess) {
              onPaymentSuccess(result.data.enrollmentId, paymentDetails.courseId);
            } else if (!result.success) {
              setError(
                "Payment succeeded but enrollment recording failed. Contact support."
              );
            }
          } catch (err) {
            setError(
              "Payment succeeded but enrollment recording failed. Contact support."
            );
            console.error("Firestore Enrollment Error:", err);
          } finally {
            setIsLoading(false);
          }
        },

        prefill: {
          name: paymentDetails.billingInfo?.name || currentUser.displayName || "",
          email: paymentDetails.billingInfo?.email || currentUser.email || "",
          contact: paymentDetails.billingInfo?.phone || currentUser.phoneNumber || "",
        },

        theme: {
          color: "#004080",
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response) {
        setError(
          `Payment failed. Code: ${response.error.code}. Reason: ${response.error.description}`
        );
        console.error("Razorpay Error:", response.error);
        setIsLoading(false);
      });

      rzp.open();
      return true;
    },
    [currentUser, loadScript, onPaymentSuccess]
  );

  return { initializePayment, isLoading, error };
};

export default useRazorpay;
