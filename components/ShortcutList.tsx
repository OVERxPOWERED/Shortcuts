import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Pressable,
} from 'react-native'
import React from 'react'

export default function ShortcutList({ shortcuts = [], shortcutListTitle, setShortcut, activeShortcut, handleDelete }: any) {
    return (
        <View style={{ ...Style.shortcutList, ...Style.section }}>
            <Text style={Style.shortcutListTitle}>{shortcutListTitle}</Text>
            <ScrollView contentContainerStyle={Style.shortcutListScroll}>
                {shortcuts.map((shortcut: Object, index: number) => (
                    <View key={index} style={{ ...Style.shortcutListItem }} >
                        <Pressable onPress={() => { setShortcut(shortcut.action ,shortcut); }} style={{ ...Style.shortcutListItemButton }}>
                            <Text style={{ ...Style.shortcutListItemText }}>
                                 {shortcut.task === "Change Settings" ? shortcut.settingName : shortcut.appName} </Text>
                            <View style={
                                { ...Style.radio, backgroundColor: (shortcut.task === "Launch App" ? (shortcut.packageName === activeShortcut?.packageName ? "black" : "transparent") : (shortcut.settingName === activeShortcut?.settingName ? "black" : "transparent")) }
                            }></View>
                        </Pressable>
                        <Pressable style={{ ...Style.shortcutListItemDeleteButton }} onPress={() => handleDelete(shortcut.action, index)}>
                            <Text style={{ ...Style.shortcutListItemDeleteButtonText }} >🗑️</Text>
                        </Pressable>
                    </View>

                ))}
            </ScrollView>
        </View>
    )
}

const Style = StyleSheet.create({
    section: {
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#000',
        padding: 10,
        marginTop: 10,
    },
    shortcutList: {
        width: '95%',
        gap: 10,
    },
    shortcutListTitle: {
        fontSize: 25,
        fontWeight: 'bold',
        color: '#000',
        textAlign: 'center',
    },
    shortcutListScroll: {},
    shortcutListItem: {
        height: 50,
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: 3,
        flexDirection: 'row',
        paddingHorizontal: 5,
    },
    shortcutListItemButton: {
        height: 50,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexDirection: 'row',
        width: '85%',
    },
    shortcutListItemText: {
        fontSize: 20,
        color: '#000',
    },
    shortcutListItemDeleteButton: {
        height: 35,
        borderColor: 'black',
        borderWidth: 2,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
        width: "10%",

    },
    shortcutListItemDeleteButtonText: {
        fontSize: 15,

    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#000',
    },
})