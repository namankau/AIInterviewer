package com.interviewos.api.user

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserService(
    private val userRepository: UserRepository,
) {
    /**
     * Provisioning happens here rather than through an auth webhook: the first
     * authenticated call a signed-in client makes is this one, so the row exists
     * before anything needs it and there is no second system to keep alive.
     */
    @Transactional
    fun loadProfile(identity: SupabaseIdentity): MeResponse {
        userRepository.provision(identity)
        return userRepository.findMe(identity.id)
            ?: error("Profile for ${identity.id} was missing immediately after provisioning.")
    }
}
