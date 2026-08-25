plugins {
    // Lets Gradle fetch the Java 21 toolchain itself when the machine only has a
    // different JDK installed, so a fresh clone builds without a manual JDK install.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "api"
