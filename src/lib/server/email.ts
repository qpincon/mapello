import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

export const resend = new Resend(env.RESEND_API_KEY);
