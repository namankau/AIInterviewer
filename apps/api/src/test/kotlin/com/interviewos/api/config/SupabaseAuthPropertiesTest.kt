package com.interviewos.api.config

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class SupabaseAuthPropertiesTest {
    @Test
    fun `derives issuer and JWKS URL from the project URL`() {
        val properties = SupabaseAuthProperties(supabaseUrl = "https://project.supabase.co")

        assertEquals("https://project.supabase.co/auth/v1", properties.issuer)
        assertEquals("https://project.supabase.co/auth/v1/.well-known/jwks.json", properties.jwkSetUri)
    }

    @Test
    fun `tolerates a trailing slash on the project URL`() {
        val properties = SupabaseAuthProperties(supabaseUrl = "https://project.supabase.co/")

        assertEquals("https://project.supabase.co/auth/v1", properties.issuer)
    }

    @Test
    fun `defaults the expected audience to Supabase's authenticated role`() {
        assertEquals("authenticated", SupabaseAuthProperties(supabaseUrl = "https://project.supabase.co").audience)
    }
}
