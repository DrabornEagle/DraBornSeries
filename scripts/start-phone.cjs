#!/usr/bin/env node
// SDK 58 binds --localhost through DNS. Force IPv4 for the same-phone Expo URL
// and avoid Bonjour's restricted network-interface lookup on Android/Termux.
process.env.EXPO_UNSTABLE_BONJOUR = '0';
require('node:dns').setDefaultResultOrder('ipv4first');
process.argv.splice(2, 0, 'start', '--go', '--localhost', '--clear');
require('@expo/cli');
