import type { PageServerLoad, Actions } from "./$types";
import { fail, redirect, type NumericRange } from "@sveltejs/kit";
import { message, setError, superValidate } from "sveltekit-superforms/server";
import { formSchema } from "./schema";
import { env } from "$env/dynamic/private";

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(302, "/app");
	}
	return {
		form: await superValidate(formSchema),
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, formSchema);
		if (!form.valid) {
			return fail(400, {
				form,
			});
		}

		const res = await fetch(`${env.BASE_API_URL}/tokens/authentication`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify({
				email: form.data.email,
				password: form.data.password,
				scope: "authentication",
			}),
		});

		const response = await res.json();
		if (!res.ok) {
			if (typeof response.error === "string") {
				return message(form, response.error, {
					status: <NumericRange<400, 599>>res.status,
				});
			}
			for (const field in response.error) {
				return setError(form, field, response.error[field]);
			}
		}

		event.cookies.set("auth-token", response.authentication_token.token, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
			maxAge: 60 * 60 * 24 * 7, // 1 week
		});

		event.cookies.set("refresh-token", response.refresh_token.token, {
			path: "/",
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
			maxAge: 60 * 60 * 24 * 30, // 1 month
		});

		redirect(303, "/app");
	},
};
