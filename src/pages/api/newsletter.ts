import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { Resend } from 'resend';

export const prerender = false;

const newsletterSchema = z.object({
  email: z.email('Please enter a valid email address'),
  honeypot: z.string().max(0).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString() || '';
    const honeypot = formData.get('honeypot')?.toString() || '';

    // Check honeypot - if filled, it's likely a bot
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = newsletterSchema.safeParse({ email, honeypot });

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error.issues[0]?.message || 'Please enter a valid email address',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = import.meta.env.RESEND_API_KEY;
    const segmentId = import.meta.env.RESEND_SEGMENT_ID;

    if (!apiKey || !segmentId) {
      console.error('Newsletter: RESEND_API_KEY or RESEND_SEGMENT_ID is not configured');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Newsletter service is not configured.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.contacts.create({
      email: result.data.email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    });

    if (error) {
      console.error('Resend newsletter error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Subscription failed. Please try again.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Newsletter error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Subscription failed. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
