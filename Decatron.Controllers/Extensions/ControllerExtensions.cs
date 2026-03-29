using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Decatron.Controllers.Extensions
{
    /// <summary>
    /// Extension methods for ControllerBase to eliminate duplicated helper methods
    /// across controllers (GetChannelOwnerId, GetUserId, etc.).
    ///
    /// Usage in a controller:
    ///   using Decatron.Controllers.Extensions;
    ///   ...
    ///   var ownerId = this.GetChannelOwnerId();
    /// </summary>
    public static class ControllerExtensions
    {
        /// <summary>
        /// Gets the effective channel owner ID using the priority chain:
        ///   1. ActiveChannelId from session (set after channel switch)
        ///   2. ChannelOwnerId claim from JWT
        ///   3. The authenticated user's own ID (NameIdentifier claim)
        /// </summary>
        public static long GetChannelOwnerId(this ControllerBase controller)
        {
            // PRIORITY 1: Active channel from session (after switch)
            var sessionChannelId = controller.HttpContext.Session.GetString("ActiveChannelId");
            if (!string.IsNullOrEmpty(sessionChannelId) && long.TryParse(sessionChannelId, out var sessionId))
            {
                return sessionId;
            }

            // PRIORITY 2: ChannelOwnerId claim from JWT
            var channelOwnerIdClaim = controller.HttpContext.User.FindFirst("ChannelOwnerId")?.Value;
            if (long.TryParse(channelOwnerIdClaim, out var channelOwnerId))
            {
                return channelOwnerId;
            }

            // PRIORITY 3: Fall back to the user's own ID
            return controller.GetAuthenticatedUserId();
        }

        /// <summary>
        /// Gets the authenticated user's ID from the NameIdentifier claim.
        /// Returns 0 if not found or not parseable.
        /// </summary>
        public static long GetAuthenticatedUserId(this ControllerBase controller)
        {
            var userIdClaim = controller.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
