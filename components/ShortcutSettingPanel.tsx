import {
    StyleSheet,
    Text,
    View,
    Modal,
    Pressable,
    ScrollView,
    FlatList,
    Dimensions,
    NativeModules,
} from 'react-native'
import React, { useState, useEffect } from 'react'

const { height, width } = Dimensions.get('window');
const { InstalledApps } = NativeModules;




export default function ShortcutSettingPanel({
    modalVisible,
    setModalVisible,
    actionRadioValue,
    setActionRadioValue,
    taskRadioValue,
    setTaskRadioValue,
    selectedSetting,
    setSelectedSetting,
    selectedApp,
    setSelectedApp,
    selectedAppPackageName,
    setSelectedAppPackageName,
    handleCancel,
    handleSave,
}: any) {


    const [readyToRenderModal, setReadyToRenderModal] = useState(false);

    useEffect(() => {
        if (modalVisible) {
            const timeout = setTimeout(() => setReadyToRenderModal(true), 50);
            return () => clearTimeout(timeout);
        } else {
            setReadyToRenderModal(false);
        }
    }, [modalVisible]);

    const [settingList, setSettingList] = useState(["Airplane Mode", "Bluetooth", "Hotspot", "Location", "Screen-Rotation", "Wi-Fi"]);
    const [appList, setAppList] = useState([]);

    useEffect(() => {
        InstalledApps.getInstalledApps()
            .then(apps => { setAppList(apps.sort((a, b) => a.appName.localeCompare(b.appName))) })
            .catch(err => console.error(err));
    }, []);

    const [shortcutTitle, setShortcutTitle] = useState("Select an App");



    return (
        <View>
            <Modal animationType='slide' visible={modalVisible} backdropColor={'rgba(0,0,0,0.5)'}>

                <Pressable onPress={() => setModalVisible(false)} style={{ height: (height * 0.3), }}></Pressable>
                <View style={Style.shortcutSettingContentBox}>

                   {readyToRenderModal && <ScrollView>

                        <Text style={{ ...Style.shortcutSettingContentBoxTitle, }}>Shortcut Options</Text>

                        <View style={Style.shortcutSettingContent}>

                            <View style={{ ...Style.choiceBox, ...Style.section }}>

                                <Text style={{ ...Style.choiceLabel }}>Action : </Text>

                                <View style={{ ...Style.choiceButtonBox }} >

                                    <Pressable onPress={() => { setActionRadioValue("Single-Tap") }} style={{ ...Style.choiceButton }}>
                                        <Text style={{ ...Style.choiceButtonText }}> Single-Tap </Text>
                                        <View style={{ ...Style.radio, backgroundColor: actionRadioValue === "Single-Tap" ? "black" : "transparent" }}></View>
                                    </Pressable>

                                    <Pressable onPress={() => { setActionRadioValue("Double-Tap") }} style={{ ...Style.choiceButton }}>
                                        <Text style={{ ...Style.choiceButtonText }}> Double-Tap </Text>
                                        <View style={{ ...Style.radio, backgroundColor: actionRadioValue === "Double-Tap" ? "black" : "transparent" }}></View>
                                    </Pressable>

                                    <Pressable onPress={() => { setActionRadioValue("Triple-Tap") }} style={{ ...Style.choiceButton }}>
                                        <Text style={{ ...Style.choiceButtonText }}> Triple-Tap </Text>
                                        <View style={{ ...Style.radio, backgroundColor: actionRadioValue === "Triple-Tap" ? "black" : "transparent" }}></View>
                                    </Pressable>
                                </View>

                            </View>

                            <View style={{ ...Style.choiceBox, ...Style.section }}>

                                <Text style={{ ...Style.choiceLabel }}> Task : </Text>

                                <View style={{ ...Style.choiceButtonBox }} >

                                    <Pressable onPress={() => { setTaskRadioValue("Launch App"); setShortcutTitle("Select an App") }} style={{ ...Style.choiceButton }}>
                                        <Text style={{ ...Style.choiceButtonText }}> Launch App </Text>
                                        <View style={{ ...Style.radio, backgroundColor: taskRadioValue === "Launch App" ? "black" : "transparent" }}></View>
                                    </Pressable>

                                    <Pressable onPress={() => { setTaskRadioValue("Change Settings"); setShortcutTitle("Select a Setting") }} style={{ ...Style.choiceButton }}>
                                        <Text style={{ ...Style.choiceButtonText }}> Change Settings </Text>
                                        <View style={{ ...Style.radio, backgroundColor: taskRadioValue === "Change Settings" ? "black" : "transparent" }}></View>
                                    </Pressable>

                                </View>

                            </View>

                            <View style={{ ...Style.app_SettingList, ...Style.section }}>

                                <Text style={Style.app_SettingListTitle}>{shortcutTitle}</Text>
                                {
                                    shortcutTitle === "Select an App" ? (
                                        <FlatList
                                            nestedScrollEnabled={true}
                                            data={appList}
                                            keyExtractor={(item) => item.packageName}
                                            numColumns={1}
                                            contentContainerStyle={Style.app_SettingListScroll}
                                            showsVerticalScrollIndicator={false}
                                            renderItem={({ item }) => (
                                                <Pressable
                                                    style={{
                                                        ...Style.app_SettingListItem,
                                                        backgroundColor: selectedApp === item.appName ? "rgb(0, 0, 0)" : "transparent",
                                                    }}
                                                    onPress={() => {
                                                        setSelectedApp(item.appName);
                                                        setSelectedAppPackageName(item.packageName);
                                                        console.log(item.packageName);
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            ...Style.app_SettingListItemText,
                                                            color: selectedApp === item.appName ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
                                                            fontWeight: selectedApp === item.appName ? "bold" : "normal",
                                                        }}
                                                    >
                                                        {item.appName}
                                                    </Text>
                                                </Pressable>
                                            )}
                                        />
                                    ) : (
                                        <FlatList
                                            nestedScrollEnabled={true}
                                            data={settingList}
                                            keyExtractor={(item, index) => item + index}
                                            numColumns={1}
                                            contentContainerStyle={Style.app_SettingListScroll}
                                            showsVerticalScrollIndicator={false}
                                            renderItem={({ item }) => (
                                                <Pressable
                                                    style={{
                                                        ...Style.app_SettingListItem,
                                                        backgroundColor: selectedSetting === item ? "rgb(0, 0, 0)" : "transparent",
                                                    }}
                                                    onPress={() => {
                                                        setSelectedSetting(item);
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            ...Style.app_SettingListItemText,
                                                            color: selectedSetting === item ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)",
                                                            fontWeight: selectedSetting === item ? "bold" : "normal",
                                                        }}
                                                    >
                                                        {item}
                                                    </Text>
                                                </Pressable>
                                            )}
                                        />
                                    )
                                }

                            </View>

                            <View style={Style.shortcutSettingCloseButtonBox}>

                                <Pressable style={Style.shortcutSettingCloseButton} onPress={() => {handleSave(actionRadioValue, {action: actionRadioValue, task: taskRadioValue, appName: selectedApp, packageName: selectedAppPackageName, settingName: selectedSetting }); console.log("Saving Shortcut:", {action: actionRadioValue, task: taskRadioValue, appName: selectedApp, packageName: selectedAppPackageName, settingName: selectedSetting})}}>
                                    <Text style={Style.shortcutSettingCloseButtonText}>SAVE</Text>
                                </Pressable>

                                <Pressable style={Style.shortcutSettingCloseButton} onPress={handleCancel}>
                                    <Text style={Style.shortcutSettingCloseButtonText}>CANCEL</Text>
                                </Pressable>

                            </View>

                        </View>

                    </ScrollView>}

                </View>

            </Modal>
        </View>
    )
}

const Style = StyleSheet.create({
    section: {
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#000',
        padding: 10,
        marginTop: 10,
    },
    shortcutSettingContentBox: {
        height: height - (height * 0.3),
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        position: 'absolute',
        bottom: 0
    },
    shortcutSettingContentBoxTitle: {
        fontSize: 35,
        fontWeight: 'bold',
        color: '#000',
        paddingHorizontal: 10,
        marginTop: 20,
        marginHorizontal: 20,
        borderWidth: 2,
        borderColor: '#000',
        borderRadius: 10,
    },
    shortcutSettingContent: {
        width: '100%',
        height: '100%',
        paddingHorizontal: 20
    },
    choiceBox: {
        width: '100%',
        marginTop: 20,
    },
    choiceLabel: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#000',
    },
    choiceButtonBox: {
        width: '100%',
        marginTop: 10,
        gap: 5,
    },
    choiceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        width: '57%',

    },
    choiceButtonText: {
        fontSize: 20,
        color: '#000',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 15,
        // backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#000',
    },

    app_SettingList: {
        width: '100%',
        height: height * 0.4,
        paddingTop: 10,
        gap: 10,
    },
    app_SettingListTitle: {
        fontSize: 30,
        fontWeight: 'bold',
        color: '#000',
    },
    app_SettingListScroll: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    app_SettingListItem: {
        height: 50,
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'flex-start',
        justifyContent: 'center',
        margin: 3,
    },
    app_SettingListItemText: {
        fontSize: 20,
        color: '#000',
        paddingHorizontal: 10,
    },
    shortcutSettingCloseButtonBox: {
        width: '100%',
        height: 80,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    shortcutSettingCloseButton: {
        backgroundColor: '#000',
        height: 50,
        width: '49%',
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        marginTop: 10,
    },
    shortcutSettingCloseButtonText: {
        color: '#fff',
        fontSize: 30,
        marginBottom: 5,
    }
})