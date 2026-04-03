/* Cloudflare Web Analytics — https://developers.cloudflare.com/web-analytics/ */
(function () {
    var token =
        typeof cloudflareWebAnalyticsToken !== "undefined"
            ? String(cloudflareWebAnalyticsToken).trim()
            : "";
    if (!token) return;

    var s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: token }));
    document.body.appendChild(s);
})();
