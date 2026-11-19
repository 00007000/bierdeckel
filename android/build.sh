#!/bin/sh
# Manual build of Bierdeckel Android wrapper (no gradle). Usage: ./build.sh <versionCode> <versionName>
set -e; cd "$(dirname "$0")"
BT=~/Android/Sdk/build-tools/35.0.0; JAR=~/Android/Sdk/platforms/android-35/android.jar; B=$(mktemp -d)
$BT/aapt2 compile --dir app/src/main/res -o $B/
mkdir -p $B/gen $B/classes $B/dex
$BT/aapt2 link -o $B/base.apk -I $JAR --manifest app/src/main/AndroidManifest.xml --java $B/gen --min-sdk-version 29 --target-sdk-version 35 --version-code "$1" --version-name "$2" $B/*.flat
javac -source 17 -target 17 -nowarn -Xlint:none -classpath $JAR -d $B/classes $B/gen/dev/bierdeckel/app/R.java app/src/main/java/dev/bierdeckel/app/*.java
$BT/d8 --min-api 29 --lib $JAR --output $B/dex $(find $B/classes -name '*.class')
cp $B/base.apk $B/unaligned.apk; (cd $B/dex && zip -q ../unaligned.apk classes.dex)
$BT/zipalign -f -p 4 $B/unaligned.apk $B/aligned.apk
$BT/apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android --key-pass pass:android --out Bierdeckel.apk $B/aligned.apk
rm -rf $B; echo "built Bierdeckel.apk $2 ($1)"
