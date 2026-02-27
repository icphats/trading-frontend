// Disable prerendering for this dynamic route
export const prerender = false;

export async function load({ params }: { params: { principal: string } }) {
    // The principal ID from the URL
    const principalId = params.principal;
    
    // You can perform server-side operations here if needed
    // For example, validate the principal ID or fetch user data
    
    return {
        principalId
    };
}