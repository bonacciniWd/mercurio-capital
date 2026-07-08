const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// Force CJS entry for Supabase to avoid Hermes parse errors on optional OTEL dynamic import.
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === '@supabase/supabase-js') {
		return context.resolveRequest(
			context,
			'@supabase/supabase-js/dist/index.cjs',
			platform,
		)
	}

	return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './global.css' })
