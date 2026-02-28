import emailjs from 'emailjs-com';

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

if (!serviceId || !publicKey) {
  console.warn('EmailJS credentials missing. Email features will not work.');
} else {
  emailjs.init(publicKey);
}

export interface EmailParams {
  to_email: string;
  user_name: string;
  verification_link?: string;
  reset_link?: string;
}

export const sendSignupEmail = async (to_email: string, user_name: string, verification_link: string) => {
  try {
    await emailjs.send(import.meta.env.VITE_EMAILJS_SERVICE_ID, import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SIGNUP, {
      to_email,
      user_name,
      verification_link,
      app_name: 'Tchr'
    });
    return true;
  } catch (error) {
    console.error('Failed to send signup email:', error);
    return false;
  }
};

export const sendLoginConfirmationEmail = async (to_email: string, user_name: string) => {
  try {
    await emailjs.send(import.meta.env.VITE_EMAILJS_SERVICE_ID, import.meta.env.VITE_EMAILJS_TEMPLATE_ID_LOGIN, {
      to_email,
      user_name,
      app_name: 'Tchr'
    });
    return true;
  } catch (error) {
    console.error('Failed to send login confirmation email:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (to_email: string, user_name: string, reset_link: string) => {
  try {
    await emailjs.send(import.meta.env.VITE_EMAILJS_SERVICE_ID, import.meta.env.VITE_EMAILJS_TEMPLATE_ID_RESET, {
      to_email,
      user_name,
      reset_link,
      app_name: 'Tchr'
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
};
