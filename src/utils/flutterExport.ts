import JSZip from 'jszip';
import firebaseConfig from '../../firebase-applet-config.json';

export async function downloadFlutterGitHubIpaBundle(): Promise<void> {
  const zip = new JSZip();

  zip.file(
    'pubspec.yaml',
    `name: notifye_app
description: Mobile-first two-partner attention app with Google Sign-In, Firestore pairing, and FCM push notifications.
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.4.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.8.0
  firebase_auth: ^5.3.3
  google_sign_in: ^6.2.2
  cloud_firestore: ^5.5.0
  firebase_messaging: ^15.1.5
  cupertino_icons: ^1.0.8

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
`
  );

  zip.file(
    'lib/firebase_options.dart',
    `import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.android:
        return android;
      default:
        return web;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: '${firebaseConfig.apiKey}',
    appId: '${firebaseConfig.appId}',
    messagingSenderId: '${firebaseConfig.messagingSenderId}',
    projectId: '${firebaseConfig.projectId}',
    authDomain: '${firebaseConfig.authDomain}',
    storageBucket: '${firebaseConfig.storageBucket}',
  );

  // Replace with your iOS/Android Firebase app IDs after running \`flutterfire configure\`
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: '${firebaseConfig.apiKey}',
    appId: '${firebaseConfig.appId}',
    messagingSenderId: '${firebaseConfig.messagingSenderId}',
    projectId: '${firebaseConfig.projectId}',
    storageBucket: '${firebaseConfig.storageBucket}',
    iosBundleId: 'com.notifye.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: '${firebaseConfig.apiKey}',
    appId: '${firebaseConfig.appId}',
    messagingSenderId: '${firebaseConfig.messagingSenderId}',
    projectId: '${firebaseConfig.projectId}',
    storageBucket: '${firebaseConfig.storageBucket}',
  );
}
`
  );

  zip.file(
    'lib/main.dart',
    `import 'dart:async';
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'firebase_options.dart';

const String kFirestoreDatabaseId = '${firebaseConfig.firestoreDatabaseId}';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(const TetherApp());
}

class TetherApp extends StatelessWidget {
  const TetherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Notifye',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0B0F),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFF59E0B),
          surface: Color(0xFF14151B),
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))),
          );
        }
        final user = snapshot.data;
        if (user == null) {
          return const SignInScreen();
        }
        return PartnerRouter(user: user);
      },
    );
  }
}

class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  Future<void> _signInWithGoogle() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) return;
    final googleAuth = await googleUser.authentication;
    final cred = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    await FirebaseAuth.instance.signInWithCredential(cred);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Notifye',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 36, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              const Text(
                'A quiet space for two partners. Sign in with Google to pair and send attention alerts.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, height: 1.5),
              ),
              const SizedBox(height: 36),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  foregroundColor: const Color(0xFF0B0B0F),
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: _signInWithGoogle,
                child: const Text('Continue with Google', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PartnerRouter extends StatefulWidget {
  const PartnerRouter({super.key, required this.user});
  final User user;

  @override
  State<PartnerRouter> createState() => _PartnerRouterState();
}

class _PartnerRouterState extends State<PartnerRouter> {
  late final FirebaseFirestore _db = FirebaseFirestore.instanceFor(
    app: Firebase.app(),
    databaseId: kFirestoreDatabaseId,
  );
  final TextEditingController _codeController = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _ensureProfile();
    _setupFcm();
  }

  Future<void> _ensureProfile() async {
    final ref = _db.collection('users').doc(widget.user.uid);
    final snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        'uid': widget.user.uid,
        'displayName': widget.user.displayName ?? 'Partner',
        'photoURL': widget.user.photoURL ?? '',
        'pairId': '',
        'partnerUid': '',
        'partnerName': '',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
  }

  Future<void> _setupFcm() async {
    await FirebaseMessaging.instance.requestPermission();
    FirebaseMessaging.onMessage.listen((msg) {
      if (!mounted) return;
      final body = msg.notification?.body ?? 'Your partner wants your attention';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(body)));
    });
  }

  String _randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rand = Random.secure();
    return List.generate(6, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  Future<void> _createCode() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final code = _randomCode();
      final pairId = _db.collection('pairs').doc().id;
      final batch = _db.batch();
      batch.set(_db.collection('pairs').doc(pairId), {
        'pairId': pairId,
        'partnerAUid': widget.user.uid,
        'partnerAName': widget.user.displayName ?? 'Partner',
        'partnerAPhoto': widget.user.photoURL ?? '',
        'partnerBUid': '',
        'partnerBName': '',
        'partnerBPhoto': '',
        'memberUids': [widget.user.uid],
        'status': 'waiting',
        'lastPingAt': FieldValue.serverTimestamp(),
        'lastPingByUid': '',
        'lastPingMessage': '',
        'pingCount': 0,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.set(_db.collection('pairingCodes').doc(code), {
        'code': code,
        'creatorUid': widget.user.uid,
        'creatorName': widget.user.displayName ?? 'Partner',
        'creatorPhoto': widget.user.photoURL ?? '',
        'pairId': pairId,
        'status': 'pending',
        'claimedByUid': '',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.update(_db.collection('users').doc(widget.user.uid), {
        'pairId': pairId,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      await batch.commit();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _joinCode() async {
    final code = _codeController.text.trim().toUpperCase();
    if (code.length != 6) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final codeSnap = await _db.collection('pairingCodes').doc(code).get();
      if (!codeSnap.exists) throw Exception('Pairing code not found');
      final data = codeSnap.data()!;
      if (data['status'] != 'pending') throw Exception('Code already used');
      final pairId = data['pairId'] as String;
      final creatorUid = data['creatorUid'] as String;
      final creatorName = data['creatorName'] as String;
      final batch = _db.batch();
      batch.update(_db.collection('pairs').doc(pairId), {
        'partnerBUid': widget.user.uid,
        'partnerBName': widget.user.displayName ?? 'Partner',
        'partnerBPhoto': widget.user.photoURL ?? '',
        'memberUids': [creatorUid, widget.user.uid],
        'status': 'active',
        'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.update(_db.collection('pairingCodes').doc(code), {
        'status': 'claimed',
        'claimedByUid': widget.user.uid,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      batch.update(_db.collection('users').doc(widget.user.uid), {
        'pairId': pairId,
        'partnerUid': creatorUid,
        'partnerName': creatorName,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      await batch.commit();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendThinkOfMe(String pairId, List<dynamic> memberUids, int pingCount) async {
    final pingId = '\${(9999999999999 - DateTime.now().millisecondsSinceEpoch).toString().padLeft(13, '0')}_\${widget.user.uid.substring(0, 4)}';
    final batch = _db.batch();
    batch.update(_db.collection('pairs').doc(pairId), {
      'lastPingAt': FieldValue.serverTimestamp(),
      'lastPingByUid': widget.user.uid,
      'lastPingMessage': 'Your partner wants your attention',
      'pingCount': pingCount + 1,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    batch.set(_db.collection('pairs').doc(pairId).collection('pings').doc(pingId), {
      'pingId': pingId,
      'pairId': pairId,
      'memberUids': memberUids,
      'senderUid': widget.user.uid,
      'senderName': widget.user.displayName ?? 'Partner',
      'message': 'Your partner wants your attention',
      'kind': 'attention',
      'momentCardUrl': '',
      'aspectRatio': '',
      'createdAt': FieldValue.serverTimestamp(),
    });
    await batch.commit();
    HapticFeedback.mediumImpact();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
      stream: _db.collection('users').doc(widget.user.uid).snapshots(),
      builder: (context, userSnap) {
        final pairId = (userSnap.data?.data()?['pairId'] as String?) ?? '';
        if (pairId.isEmpty) {
          return Scaffold(
            appBar: AppBar(title: const Text('Notifye')),
            body: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_error != null) Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), foregroundColor: Colors.black),
                    onPressed: _busy ? null : _createCode,
                    child: const Text('Create pairing code'),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _codeController,
                    maxLength: 6,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(labelText: 'Enter 6-character code', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _busy ? null : _joinCode,
                    child: const Text('Link partner'),
                  ),
                ],
              ),
            ),
          );
        }

        return StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: _db.collection('pairs').doc(pairId).snapshots(),
          builder: (context, pairSnap) {
            final pair = pairSnap.data?.data();
            if (pair == null) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            final status = pair['status'] as String? ?? 'waiting';
            final memberUids = (pair['memberUids'] as List<dynamic>?) ?? [widget.user.uid];
            final pingCount = (pair['pingCount'] as int?) ?? 0;

            return Scaffold(
              appBar: AppBar(
                title: const Text('Notifye'),
                actions: [
                  IconButton(
                    onPressed: () => FirebaseAuth.instance.signOut(),
                    icon: const Icon(Icons.logout),
                  ),
                ],
              ),
              body: Center(
                child: status == 'active'
                    ? GestureDetector(
                        onTap: () => _sendThinkOfMe(pairId, memberUids, pingCount),
                        child: Container(
                          width: 220,
                          height: 220,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFF59E0B),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                                blurRadius: 48,
                                spreadRadius: 8,
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'Think of me',
                            style: TextStyle(color: Color(0xFF0B0B0F), fontSize: 22, fontWeight: FontWeight.w700),
                          ),
                        ),
                      )
                    : const Text('Waiting for partner to join with your code...'),
              ),
            );
          },
        );
      },
    );
  }
}
`
  );

  zip.file(
    '.github/workflows/build-ios-ipa.yml',
    `name: Build iOS IPA

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build_ipa:
    name: Build Flutter iOS IPA
    runs-on: macos-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.27.0'
          channel: 'stable'

      - name: Create iOS & Android platform folders if missing
        run: flutter create . --platforms=ios,android --org com.notifye

      - name: Install Flutter dependencies
        run: flutter pub get

      - name: Build unsigned iOS app bundle
        run: flutter build ios --release --no-codesign

      - name: Package IPA artifact
        run: |
          mkdir -p build/ipa/Payload
          cp -R build/ios/iphoneos/Runner.app build/ipa/Payload/
          cd build/ipa
          zip -r Notifye-unsigned.ipa Payload

      - name: Upload Notifye-unsigned.ipa
        uses: actions/upload-artifact@v4
        with:
          name: Notifye-iOS-IPA
          path: build/ipa/Notifye-unsigned.ipa
`
  );

  zip.file(
    'functions/index.js',
    `import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();

export const notifyPartnerOnPing = onDocumentCreated(
  {
    document: 'pairs/{pairId}/pings/{pingId}',
    database: '${firebaseConfig.firestoreDatabaseId}',
  },
  async (event) => {
    const ping = event.data?.data();
    if (!ping) return;

    const db = getFirestore('${firebaseConfig.firestoreDatabaseId}');
    const recipientUid = (ping.memberUids || []).find((uid) => uid !== ping.senderUid);
    if (!recipientUid) return;

    const deviceSnap = await db
      .collection('pairs')
      .doc(ping.pairId)
      .collection('devices')
      .doc(recipientUid)
      .get();

    const fcmToken = deviceSnap.data()?.fcmToken;
    if (!fcmToken) return;

    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: 'Notifye',
        body: 'Your partner wants your attention',
      },
      data: {
        pairId: ping.pairId,
        pingId: ping.pingId,
      },
    });
  }
);
`
  );

  zip.file(
    'README.md',
    `# Notifye — Flutter + GitHub Actions iOS IPA Bundle

## 1. Push to GitHub
\`\`\`bash
git init
git add .
git commit -m "Initial Notifye Flutter app"
git branch -M main
git remote add origin https://github.com/<your-username>/notifye-app.git
git push -u origin main
\`\`\`

## 2. Configure Native Firebase iOS/Android Apps
Run \`dart pub global activate flutterfire_cli\` and \`flutterfire configure --project=${firebaseConfig.projectId}\` to add \`GoogleService-Info.plist\` (iOS) and \`google-services.json\` (Android).

## 3. Build the .ipa via GitHub Actions
Push to \`main\` or open the **Actions** tab on GitHub and run **Build iOS IPA**.
Once finished, download \`Notifye-iOS-IPA\` containing \`Notifye-unsigned.ipa\` (ready for AltStore / Sideloadly or signing with your Apple Developer certificate).

## 4. Background Push Notifications
Deploy \`functions/index.js\` via \`firebase deploy --only functions\` on a Blaze-enabled Firebase project to send APNs/FCM push notifications when the app is closed.
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notifye-flutter-ipa.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
